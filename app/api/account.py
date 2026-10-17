from decimal import Decimal

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import func, select, update
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_current_user, require_seller
from app.db.session import get_db
from app.models.coin import Coin
from app.models.shipping_address import ShippingAddress
from app.models.user import User
from app.schemas.account import (
    MAX_ADDRESSES,
    AddressCreate,
    AddressRead,
    SellerSettings,
    SellerSettingsSaved,
    ShippingOption,
)
from app.services.notifications import send_payment_details_updated_emails

router = APIRouter(prefix="/account", tags=["account"])


def seller_shipping_options(user: User) -> list[ShippingOption]:
    return [ShippingOption.model_validate(option) for option in user.shipping_options or []]


def _seller_settings(user: User) -> SellerSettings:
    return SellerSettings(
        payment_details=user.payment_details,
        contact_email=user.contact_email,
        contact_phone=user.contact_phone,
        contact_note=user.contact_note,
        shipping_options=seller_shipping_options(user),
    )


@router.get("/seller-settings", response_model=SellerSettings)
async def get_seller_settings(current_user: User = Depends(require_seller)) -> SellerSettings:
    return _seller_settings(current_user)


@router.put("/seller-settings", response_model=SellerSettingsSaved)
async def update_seller_settings(
    data: SellerSettings,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_seller),
) -> SellerSettingsSaved:
    """Payment details and contacts go to the buyers of the seller's coins; shipping options
    are offered at checkout. Orders keep the shipping option they were placed with.

    Changed payment details are emailed to the buyers whose orders still await payment."""
    details_changed = data.payment_details is not None and (
        data.payment_details != current_user.payment_details
    )
    if data.payment_details is None and current_user.payment_details:
        # Buyers of the lots on sale would get no way to pay.
        on_sale = await db.scalar(
            select(func.count())
            .select_from(Coin)
            .where(Coin.owner_id == current_user.id, Coin.status == "for_sale")
        )
        if on_sale:
            raise HTTPException(
                status_code=409,
                detail=f"You have {on_sale} lots on sale: withdraw them before removing your "
                "payment details, or change the details instead.",
            )
    current_user.payment_details = data.payment_details
    current_user.contact_email = data.contact_email
    current_user.contact_phone = data.contact_phone
    current_user.contact_note = data.contact_note
    # Prices as strings in JSON: exact, like the NUMERIC columns.
    current_user.shipping_options = [
        {"name": option.name, "price": str(option.price.quantize(Decimal("0.01")))}
        for option in data.shipping_options
    ]
    # Queued in the same transaction as the change.
    notified = await send_payment_details_updated_emails(db, current_user) if details_changed else 0
    await db.commit()
    await db.refresh(current_user)
    return SellerSettingsSaved(
        **_seller_settings(current_user).model_dump(), buyers_notified=notified
    )


@router.get("/addresses", response_model=list[AddressRead])
async def list_addresses(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> list[ShippingAddress]:
    result = await db.execute(
        select(ShippingAddress)
        .where(ShippingAddress.user_id == current_user.id)
        .order_by(ShippingAddress.is_default.desc(), ShippingAddress.id)
    )
    return list(result.scalars().all())


async def _make_default(db: AsyncSession, user: User, address: ShippingAddress) -> None:
    await db.execute(
        update(ShippingAddress)
        .where(ShippingAddress.user_id == user.id, ShippingAddress.id != address.id)
        .values(is_default=False)
    )
    address.is_default = True


@router.post("/addresses", response_model=AddressRead, status_code=201)
async def create_address(
    data: AddressCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> ShippingAddress:
    count = await db.scalar(
        select(func.count())
        .select_from(ShippingAddress)
        .where(ShippingAddress.user_id == current_user.id)
    )
    if (count or 0) >= MAX_ADDRESSES:
        raise HTTPException(
            status_code=400, detail=f"You can save at most {MAX_ADDRESSES} addresses"
        )
    address = ShippingAddress(user_id=current_user.id, **data.model_dump(exclude={"is_default"}))
    db.add(address)
    await db.flush()
    # The first address is the default one.
    if data.is_default or not count:
        await _make_default(db, current_user, address)
    await db.commit()
    await db.refresh(address)
    return address


async def _own_address(db: AsyncSession, user: User, address_id: int) -> ShippingAddress:
    address = await db.get(ShippingAddress, address_id)
    if address is None or address.user_id != user.id:
        raise HTTPException(status_code=404, detail="Address not found")
    return address


@router.put("/addresses/{address_id}", response_model=AddressRead)
async def update_address(
    address_id: int,
    data: AddressCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> ShippingAddress:
    """Orders already placed keep the address they were placed with."""
    address = await _own_address(db, current_user, address_id)
    for field, value in data.model_dump(exclude={"is_default"}).items():
        setattr(address, field, value)
    if data.is_default:
        await _make_default(db, current_user, address)
    await db.commit()
    await db.refresh(address)
    return address


@router.delete("/addresses/{address_id}", status_code=204)
async def delete_address(
    address_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> None:
    address = await _own_address(db, current_user, address_id)
    was_default = address.is_default
    await db.delete(address)
    await db.flush()
    if was_default:
        # Another address becomes the default, so checkout still preselects one.
        oldest = await db.scalar(
            select(ShippingAddress)
            .where(ShippingAddress.user_id == current_user.id)
            .order_by(ShippingAddress.id)
            .limit(1)
        )
        if oldest is not None:
            oldest.is_default = True
    await db.commit()

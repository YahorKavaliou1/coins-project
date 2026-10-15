import asyncio
import contextlib
import logging
from typing import Annotated, Literal

from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import StringConstraints
from sqlalchemy import ColumnElement, String, cast, func, or_, select, update
from sqlalchemy.dialects.postgresql import ARRAY
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import InstrumentedAttribute, selectinload

from app.api.deps import get_optional_current_user, require_seller
from app.db.session import get_db
from app.models.coin import Coin
from app.models.country import Country
from app.models.favourite import Favourite
from app.models.metal import Metal
from app.models.order import Order
from app.models.order_item import OrderItem
from app.models.user import User
from app.schemas.coin import (
    CoinCreate,
    CoinFacets,
    CoinIdsRequest,
    CoinIdsResult,
    CoinRead,
    CoinUpdate,
    LabelFacet,
    MetalFacet,
    MyLotCounts,
    MyLotRead,
    MyLotsPage,
    Page,
    SaleInfo,
)
from app.schemas.fields import MAX_DB_INT, MAX_LABEL_LENGTH
from app.services.image_storage import ImageStorage, get_image_storage

logger = logging.getLogger("app.coins")

router = APIRouter(prefix="/coins", tags=["coins"])

# Query parameters are bounded so that out-of-range values get a 422 instead of reaching
# the database (INTEGER overflow) or making it scan with huge patterns and offsets.
IdsQuery = Annotated[list[int] | None, Query(max_length=100)]
YearQuery = Annotated[int | None, Query(ge=-1000, le=2100)]
SearchQuery = Annotated[str | None, Query(max_length=100)]
GradeQuery = Annotated[str | None, Query(max_length=50)]
CategoryQuery = Annotated[str | None, Query(max_length=50)]
LabelsQuery = Annotated[
    list[Annotated[str, StringConstraints(max_length=MAX_LABEL_LENGTH)]] | None,
    Query(max_length=50),
]

COIN_LOAD_OPTIONS = (
    selectinload(Coin.country),
    selectinload(Coin.metal),
    selectinload(Coin.owner),
    selectinload(Coin.images),
)


async def _get_favourite_ids(db: AsyncSession, user: User | None) -> set[int]:
    if user is None:
        return set()
    result = await db.execute(select(Favourite.coin_id).where(Favourite.user_id == user.id))
    return {row[0] for row in result.all()}


async def _validate_country_and_metal(db: AsyncSession, country_id: int, metal_id: int) -> None:
    country = await db.get(Country, country_id)
    if country is None:
        raise HTTPException(status_code=404, detail="Country not found")

    metal = await db.get(Metal, metal_id)
    if metal is None:
        raise HTTPException(status_code=404, detail="Metal not found")


def _build_common_conditions(
    *,
    country_id: list[int] | None,
    year_from: int | None,
    year_to: int | None,
    q: str | None,
    for_sale_only: bool,
    owner_id: int | None,
) -> list[ColumnElement[bool]]:
    """Filters shared by the coin list and the facets endpoint.

    Deliberately excludes the facet filters (metal, grade, category): see
    _facet_conditions.
    """
    conditions: list[ColumnElement[bool]] = []

    if country_id:
        conditions.append(Coin.country_id.in_(country_id))
    if year_from is not None:
        conditions.append(Coin.year >= year_from)
    if year_to is not None:
        conditions.append(Coin.year <= year_to)
    if q:
        # % and _ are LIKE wildcards: match them literally, as the user typed them.
        escaped = q.replace("\\", "\\\\").replace("%", "\\%").replace("_", "\\_")
        pattern = f"%{escaped}%"
        q_conditions: list[ColumnElement[bool]] = [
            Country.name.ilike(pattern, escape="\\"),
            Metal.name.ilike(pattern, escape="\\"),
            Coin.denomination.ilike(pattern, escape="\\"),
            Coin.extra_info.ilike(pattern, escape="\\"),
        ]
        with contextlib.suppress(ValueError):
            q_conditions.append(Coin.year == int(q))
        conditions.append(or_(*q_conditions))
    # Withdrawn lots are their seller's business only: see /coins/mine.
    conditions.append(Coin.status != "withdrawn")
    if for_sale_only:
        conditions.append(Coin.status == "for_sale")
    if owner_id is not None:
        conditions.append(Coin.owner_id == owner_id)

    return conditions


def _facet_conditions(
    *,
    metal_id: list[int] | None,
    grade: str | None,
    category: str | None,
    label: list[str] | None,
) -> dict[str, ColumnElement[bool]]:
    """The active facet filters by facet name.

    Each facet's options are computed with every active filter except its own, so picking
    one value doesn't make the other values of the same facet disappear (standard
    faceted-search behaviour).
    """
    conditions: dict[str, ColumnElement[bool]] = {}
    if metal_id:
        conditions["metal"] = Coin.metal_id.in_(metal_id)
    if grade:
        conditions["grade"] = Coin.grade == grade
    if category:
        conditions["category"] = Coin.category == category
    if label:
        # A coin matches if it has at least one of the selected labels.
        conditions["label"] = Coin.labels.overlap(cast(label, ARRAY(String)))
    return conditions


@router.get("/facets", response_model=CoinFacets)
async def get_coin_facets(
    db: AsyncSession = Depends(get_db),
    country_id: IdsQuery = None,
    metal_id: IdsQuery = None,
    grade: GradeQuery = None,
    category: CategoryQuery = None,
    label: LabelsQuery = None,
    year_from: YearQuery = None,
    year_to: YearQuery = None,
    q: SearchQuery = None,
    for_sale_only: bool = False,
) -> CoinFacets:
    common = _build_common_conditions(
        country_id=country_id,
        year_from=year_from,
        year_to=year_to,
        q=q,
        for_sale_only=for_sale_only,
        owner_id=None,
    )
    facets = _facet_conditions(metal_id=metal_id, grade=grade, category=category, label=label)

    def filtered_except(facet: str) -> list[ColumnElement[bool]]:
        return [*common, *(cond for name, cond in facets.items() if name != facet)]

    metals_stmt = (
        select(Metal.id, Metal.name)
        .select_from(Coin)
        .join(Coin.metal)
        .join(Coin.country)
        .where(*filtered_except("metal"))
        .distinct()
        .order_by(Metal.name)
    )
    metals = [MetalFacet(id=row.id, name=row.name) for row in (await db.execute(metals_stmt))]

    async def distinct_values(column: InstrumentedAttribute[str | None], facet: str) -> list[str]:
        stmt = (
            select(column)
            .select_from(Coin)
            .join(Coin.metal)
            .join(Coin.country)
            .where(column.is_not(None), column != "", *filtered_except(facet))
            .distinct()
            .order_by(column)
        )
        return [row[0] for row in await db.execute(stmt)]

    # Most used first: the shop shows only the top labels until the visitor expands the list.
    label_rows = (
        select(func.unnest(Coin.labels).label("name"))
        .select_from(Coin)
        .join(Coin.metal)
        .join(Coin.country)
        .where(*filtered_except("label"))
        .subquery()
    )
    count = func.count().label("count")
    labels_stmt = (
        select(label_rows.c.name, count)
        .group_by(label_rows.c.name)
        .order_by(count.desc(), label_rows.c.name)
    )
    labels = [LabelFacet(name=row.name, count=row.count) for row in await db.execute(labels_stmt)]

    return CoinFacets(
        metals=metals,
        grades=await distinct_values(Coin.grade, "grade"),
        categories=await distinct_values(Coin.category, "category"),
        labels=labels,
    )


SORT_OPTIONS: dict[str, ColumnElement] = {
    "recent": Coin.created_at.desc(),
    "price_asc": Coin.price.asc().nulls_last(),
    "price_desc": Coin.price.desc().nulls_last(),
    "date_asc": Coin.year.asc(),
    "date_desc": Coin.year.desc(),
}


@router.get("", response_model=Page)
async def list_coins(
    db: AsyncSession = Depends(get_db),
    country_id: IdsQuery = None,
    metal_id: IdsQuery = None,
    grade: GradeQuery = None,
    category: CategoryQuery = None,
    label: LabelsQuery = None,
    year_from: YearQuery = None,
    year_to: YearQuery = None,
    q: SearchQuery = None,
    for_sale_only: bool = False,
    owner_id: int | None = Query(default=None, ge=1, le=MAX_DB_INT),
    sort: str = Query(default="recent"),
    page: int = Query(default=1, ge=1, le=10_000),
    page_size: int = Query(default=20, ge=1, le=100),
    current_user: User | None = Depends(get_optional_current_user),
) -> Page:
    stmt = select(Coin).join(Coin.country).join(Coin.metal).options(*COIN_LOAD_OPTIONS)

    conditions = _build_common_conditions(
        country_id=country_id,
        year_from=year_from,
        year_to=year_to,
        q=q,
        for_sale_only=for_sale_only,
        owner_id=owner_id,
    )
    conditions.extend(
        _facet_conditions(metal_id=metal_id, grade=grade, category=category, label=label).values()
    )

    for condition in conditions:
        stmt = stmt.where(condition)

    total = (await db.execute(select(func.count()).select_from(stmt.subquery()))).scalar_one()

    order_clause = SORT_OPTIONS.get(sort, SORT_OPTIONS["recent"])
    stmt = stmt.order_by(order_clause).offset((page - 1) * page_size).limit(page_size)
    result = await db.execute(stmt)
    coins = list(result.scalars().unique().all())

    favourite_ids = await _get_favourite_ids(db, current_user)
    items = [
        CoinRead.model_validate(coin, context={"favourite_coin_ids": favourite_ids})
        for coin in coins
    ]

    return Page(items=items, total=total, page=page, page_size=page_size)


@router.get("/mine", response_model=MyLotsPage)
async def list_my_lots(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_seller),
    status: Literal["for_sale", "withdrawn", "sold"] = "for_sale",
    page: int = Query(default=1, ge=1, le=10_000),
    page_size: int = Query(default=20, ge=1, le=100),
) -> MyLotsPage:
    """The seller's own lots in one state, with how each sold one was bought."""
    mine = Coin.owner_id == current_user.id

    count_rows = await db.execute(
        select(Coin.status, func.count()).where(mine).group_by(Coin.status)
    )
    counts = MyLotCounts(**{row[0]: row[1] for row in count_rows.all()})

    stmt = select(Coin).options(*COIN_LOAD_OPTIONS).where(mine, Coin.status == status)
    if status == "sold":
        # Most recent sale first.
        stmt = stmt.join(OrderItem, OrderItem.coin_id == Coin.id).join(OrderItem.order)
        stmt = stmt.order_by(Order.created_at.desc(), Coin.id.desc())
    else:
        stmt = stmt.order_by(Coin.created_at.desc(), Coin.id.desc())
    stmt = stmt.offset((page - 1) * page_size).limit(page_size)
    coins = list((await db.execute(stmt)).scalars().unique().all())

    sales: dict[int, SaleInfo] = {}
    if status == "sold" and coins:
        sale_rows = await db.execute(
            select(OrderItem, Order, User.full_name)
            .join(OrderItem.order)
            .join(User, User.id == Order.buyer_id)
            .where(OrderItem.coin_id.in_([coin.id for coin in coins]))
        )
        for item, order, buyer_name in sale_rows.all():
            sales[item.coin_id] = SaleInfo(
                order_id=order.id,
                sold_at=order.created_at,
                price_paid=item.price_paid,
                buyer_name=buyer_name,
                shipping_address=order.shipping_address,
            )

    favourite_ids = await _get_favourite_ids(db, current_user)
    items = []
    for coin in coins:
        lot = MyLotRead.model_validate(coin, context={"favourite_coin_ids": favourite_ids})
        lot.sale = sales.get(coin.id)
        items.append(lot)

    return MyLotsPage(
        items=items,
        total=getattr(counts, status),
        page=page,
        page_size=page_size,
        counts=counts,
    )


async def _change_status(
    db: AsyncSession, user: User, coin_ids: list[int], *, from_status: str, to_status: str
) -> CoinIdsResult:
    # Only the user's own coins that are in from_status: a coin sold meanwhile stays sold.
    result = await db.execute(
        update(Coin)
        .where(Coin.id.in_(coin_ids), Coin.owner_id == user.id, Coin.status == from_status)
        .values(status=to_status)
        .returning(Coin.id)
    )
    changed = sorted(row[0] for row in result.all())
    await db.commit()
    return CoinIdsResult(coin_ids=changed)


@router.post("/withdraw", response_model=CoinIdsResult)
async def withdraw_coins(
    data: CoinIdsRequest,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_seller),
) -> CoinIdsResult:
    """Takes the seller's lots off sale: hidden from the shop and can't be bought."""
    return await _change_status(
        db, current_user, data.coin_ids, from_status="for_sale", to_status="withdrawn"
    )


@router.post("/relist", response_model=CoinIdsResult)
async def relist_coins(
    data: CoinIdsRequest,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_seller),
) -> CoinIdsResult:
    """Puts withdrawn lots back on sale."""
    return await _change_status(
        db, current_user, data.coin_ids, from_status="withdrawn", to_status="for_sale"
    )


@router.get("/{coin_id}", response_model=CoinRead)
async def get_coin(
    coin_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User | None = Depends(get_optional_current_user),
) -> CoinRead:
    stmt = select(Coin).options(*COIN_LOAD_OPTIONS).where(Coin.id == coin_id)
    coin = (await db.execute(stmt)).scalar_one_or_none()
    if coin is None:
        raise HTTPException(status_code=404, detail="Coin not found")

    favourite_ids = await _get_favourite_ids(db, current_user)
    return CoinRead.model_validate(coin, context={"favourite_coin_ids": favourite_ids})


@router.post("", response_model=CoinRead, status_code=201)
async def create_coin(
    data: CoinCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_seller),
) -> Coin:
    await _validate_country_and_metal(db, data.country_id, data.metal_id)

    coin = Coin(**data.model_dump(), owner_id=current_user.id)
    db.add(coin)
    await db.commit()
    await db.refresh(coin, attribute_names=["country", "metal", "owner", "images"])
    return coin


@router.patch("/{coin_id}", response_model=CoinRead)
async def update_coin(
    coin_id: int,
    data: CoinUpdate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_seller),
) -> Coin:
    coin = await db.get(Coin, coin_id)
    if coin is None:
        raise HTTPException(status_code=404, detail="Coin not found")
    if coin.owner_id != current_user.id and not current_user.is_admin:
        raise HTTPException(status_code=403, detail="You do not own this coin")
    if coin.status == "sold":
        raise HTTPException(status_code=409, detail="Sold coins cannot be edited")

    update_data = data.model_dump(exclude_unset=True)

    new_country_id = update_data.get("country_id", coin.country_id)
    new_metal_id = update_data.get("metal_id", coin.metal_id)
    if "country_id" in update_data or "metal_id" in update_data:
        await _validate_country_and_metal(db, new_country_id, new_metal_id)

    for field, value in update_data.items():
        setattr(coin, field, value)

    await db.commit()
    await db.refresh(coin, attribute_names=["country", "metal", "owner", "images"])
    return coin


@router.delete("/{coin_id}", status_code=204)
async def delete_coin(
    coin_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_seller),
    storage: ImageStorage = Depends(get_image_storage),
) -> None:
    coin = await db.get(Coin, coin_id, options=[selectinload(Coin.images)])
    if coin is None:
        raise HTTPException(status_code=404, detail="Coin not found")
    if coin.owner_id != current_user.id and not current_user.is_admin:
        raise HTTPException(status_code=403, detail="You do not own this coin")
    # Orders reference sold coins; their history must stay intact.
    if coin.status == "sold":
        raise HTTPException(status_code=409, detail="Sold coins cannot be deleted")

    image_urls = [image.url for image in coin.images]
    await db.delete(coin)
    await db.commit()

    # After the commit, so a failed delete never leaves a coin without its photos.
    for url in image_urls:
        try:
            await asyncio.to_thread(storage.delete_image_file, url)
        except Exception:
            logger.exception("Could not delete photo %s of deleted coin %s", url, coin_id)

import asyncio
import contextlib
import logging
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import ColumnElement, func, or_, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.api.deps import get_optional_current_user, require_seller
from app.db.session import get_db
from app.models.coin import Coin
from app.models.country import Country
from app.models.favourite import Favourite
from app.models.metal import Metal
from app.models.user import User
from app.schemas.coin import CoinCreate, CoinFacets, CoinRead, CoinUpdate, MetalFacet, Page
from app.schemas.fields import MAX_DB_INT
from app.services.image_storage import ImageStorage, get_image_storage

logger = logging.getLogger("app.coins")

router = APIRouter(prefix="/coins", tags=["coins"])

# Query parameters are bounded so that out-of-range values get a 422 instead of reaching
# the database (INTEGER overflow) or making it scan with huge patterns and offsets.
IdsQuery = Annotated[list[int] | None, Query(max_length=100)]
YearQuery = Annotated[int | None, Query(ge=-1000, le=2100)]
SearchQuery = Annotated[str | None, Query(max_length=100)]
GradeQuery = Annotated[str | None, Query(max_length=50)]

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

    Deliberately excludes metal_id and grade — those are handled separately
    so that toggling one facet doesn't hide the other available options
    (standard faceted-search behavior).
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
    if for_sale_only:
        conditions.append(Coin.is_for_sale.is_(True))
    if owner_id is not None:
        conditions.append(Coin.owner_id == owner_id)

    return conditions


@router.get("/facets", response_model=CoinFacets)
async def get_coin_facets(
    db: AsyncSession = Depends(get_db),
    country_id: IdsQuery = None,
    metal_id: IdsQuery = None,
    grade: GradeQuery = None,
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

    # Metals available given every active filter except the metal filter
    # itself, so picking one metal doesn't make the others disappear.
    metals_stmt = select(Metal.id, Metal.name).select_from(Coin).join(Coin.metal).join(Coin.country)
    for condition in common:
        metals_stmt = metals_stmt.where(condition)
    if grade:
        metals_stmt = metals_stmt.where(Coin.grade == grade)
    metals_stmt = metals_stmt.distinct().order_by(Metal.name)

    metals_result = await db.execute(metals_stmt)
    metals = [MetalFacet(id=row.id, name=row.name) for row in metals_result.all()]

    # Grades available given every active filter except the grade filter itself.
    grades_stmt = (
        select(Coin.grade)
        .select_from(Coin)
        .join(Coin.metal)
        .join(Coin.country)
        .where(Coin.grade.is_not(None))
    )
    for condition in common:
        grades_stmt = grades_stmt.where(condition)
    if metal_id:
        grades_stmt = grades_stmt.where(Coin.metal_id.in_(metal_id))
    grades_stmt = grades_stmt.distinct().order_by(Coin.grade)

    grades_result = await db.execute(grades_stmt)
    grades = [row[0] for row in grades_result.all() if row[0]]

    return CoinFacets(metals=metals, grades=grades)


SORT_OPTIONS: dict[str, ColumnElement] = {
    "recent": Coin.created_at.desc(),
    "price_asc": Coin.price.asc().nulls_last(),
    "price_desc": Coin.price.desc().nulls_last(),
    "weight_asc": Coin.weight.asc(),
    "weight_desc": Coin.weight.desc(),
    "date_asc": Coin.year.asc(),
    "date_desc": Coin.year.desc(),
}


@router.get("", response_model=Page)
async def list_coins(
    db: AsyncSession = Depends(get_db),
    country_id: IdsQuery = None,
    metal_id: IdsQuery = None,
    grade: GradeQuery = None,
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
    if metal_id:
        conditions.append(Coin.metal_id.in_(metal_id))
    if grade:
        conditions.append(Coin.grade == grade)

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
    if not coin.is_for_sale:
        raise HTTPException(status_code=409, detail="Sold coins cannot be edited")

    update_data = data.model_dump(exclude_unset=True)
    update_data.pop("is_for_sale", None)

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
    if not coin.is_for_sale:
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

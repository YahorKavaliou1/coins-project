"""Export of a seller's lots to an Excel workbook.

The columns before "Photos" use the batch import's header names (frontend/src/utils/
batchImport.ts), so an exported table and its photo folder can be imported again as is;
the import ignores the extra columns (ID, status, sale details).
"""

import io
import re
from dataclasses import dataclass
from datetime import datetime
from typing import Any

from openpyxl import Workbook
from openpyxl.cell import WriteOnlyCell
from openpyxl.styles import Font
from openpyxl.worksheet.worksheet import Worksheet

from app.models.coin import Coin
from app.models.order import Order
from app.models.order_item import OrderItem

STATUS_LABELS = {"for_sale": "For sale", "withdrawn": "Withdrawn", "sold": "Sold"}
DATE_FORMAT = "yyyy-mm-dd hh:mm"


@dataclass
class ExportedPhoto:
    url: str
    filename: str


def _photo_filename(coin: Coin, position: int, url: str) -> str:
    """'1234-1.jpg': the lot id keeps names unique; the SKU, if any, makes them readable."""
    ext = url.rsplit(".", 1)[-1].lower() if "." in url.rsplit("/", 1)[-1] else "jpg"
    sku = re.sub(r"[^A-Za-z0-9_-]+", "-", coin.sku or "").strip("-")[:40]
    stem = f"{coin.id}-{sku}" if sku else str(coin.id)
    return f"{stem}-{position}.{ext}"


def _naive_utc(value: datetime | None) -> datetime | None:
    # Excel has no time zones; times are shown in UTC like on the site.
    return value.replace(tzinfo=None) if value is not None else None


def build_lots_workbook(
    coins: list[Coin], sales: dict[int, tuple[OrderItem, Order, str | None]]
) -> tuple[bytes, list[ExportedPhoto]]:
    """Returns the .xlsx file and the photos it names, in the order of `coins`."""
    workbook = Workbook(write_only=True)
    sheet: Worksheet = workbook.create_sheet("Lots")
    sheet.freeze_panes = "A2"
    headers = [
        "ID",
        "Status",
        # The batch import's columns, with its header names.
        "Country",
        "Year",
        "Denomination",
        "Metal",
        "Composition",
        "Weight unit",
        "Weight",
        "Diameter (mm)",
        "Grade",
        "SKU",
        "Source link",
        "Category",
        "Labels",
        "Catalog No.",
        "Mintage",
        "Extra info",
        "Price (EUR)",
        "Photos",
        # Extra information about the lot.
        "Listed at (UTC)",
        "Sold at (UTC)",
        "Order No.",
        "Price paid (EUR)",
        "Buyer",
        "Ship to",
    ]
    bold = Font(bold=True)
    header_cells = []
    for title in headers:
        cell = WriteOnlyCell(sheet, value=title)
        cell.font = bold
        header_cells.append(cell)
    sheet.append(header_cells)

    photos: list[ExportedPhoto] = []
    for coin in coins:
        names = []
        for position, image in enumerate(coin.images, start=1):
            name = _photo_filename(coin, position, image.url)
            photos.append(ExportedPhoto(url=image.url, filename=name))
            names.append(name)

        sale = sales.get(coin.id)
        item, order, buyer_name = sale if sale else (None, None, None)
        row: list[Any] = [
            coin.id,
            STATUS_LABELS.get(coin.status, coin.status),
            coin.country.name,
            coin.year,
            coin.denomination,
            coin.metal.name,
            coin.composition,
            coin.weight_unit,
            coin.weight,
            coin.diameter,
            coin.grade,
            coin.sku,
            coin.source_url,
            coin.category,
            ", ".join(coin.labels),
            coin.catalog_number,
            coin.mintage,
            coin.extra_info,
            float(coin.price) if coin.price is not None else None,
            "; ".join(names),
            _naive_utc(coin.created_at),
            _naive_utc(order.created_at) if order else None,
            order.id if order else None,
            float(item.price_paid) if item else None,
            buyer_name,
            order.shipping_address if order else None,
        ]
        cells = []
        for value in row:
            cell = WriteOnlyCell(sheet, value=value)
            if isinstance(value, str):
                # Always text, never a formula: buyers type the address, sellers the extra
                # info, and "=HYPERLINK(...)" must not become a live formula in Excel.
                cell.data_type = "s"
            elif isinstance(value, datetime):
                cell.number_format = DATE_FORMAT
            cells.append(cell)
        sheet.append(cells)

    buffer = io.BytesIO()
    workbook.save(buffer)
    return buffer.getvalue(), photos

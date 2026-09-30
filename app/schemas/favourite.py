from pydantic import BaseModel

from app.schemas.fields import DbId


class FavouriteAdd(BaseModel):
    coin_id: DbId

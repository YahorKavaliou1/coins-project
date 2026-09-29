from pydantic import BaseModel


class FavouriteAdd(BaseModel):
    coin_id: int

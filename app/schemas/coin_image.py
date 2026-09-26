from datetime import datetime

from pydantic import BaseModel, ConfigDict


class CoinImageRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    url: str
    position: int
    created_at: datetime

from fastapi import FastAPI
from fastapi.staticfiles import StaticFiles

from app.api import auth, cart, coin_images, coins, countries, metals, orders, users

app = FastAPI(title="Coins API")

app.include_router(auth.router)
app.include_router(users.router)
app.include_router(countries.router)
app.include_router(metals.router)
app.include_router(coins.router)
app.include_router(coin_images.router)
app.include_router(cart.router)
app.include_router(orders.router)


@app.get("/health")
async def health():
    return {"status": "ok"}


app.mount("/static", StaticFiles(directory="app/static"), name="static")
app.mount("/", StaticFiles(directory="app/static", html=True), name="root")

from typing import List

from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.database import get_db
from app.models import User
from app.schemas import UserOut
from app.seed import DEMO_TEAM_ID

router = APIRouter(prefix="/api/teams", tags=["teams"])


@router.get("/demo/members", response_model=List[UserOut])
def list_demo_members(db: Session = Depends(get_db)):
    users = db.query(User).filter(User.team_id == DEMO_TEAM_ID).all()
    return [UserOut.model_validate(u) for u in users]

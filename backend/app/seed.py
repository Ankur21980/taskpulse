from pymongo.database import Database

from app.repositories.teams import find_team_by_id, insert_team

DEMO_TEAM_ID = "00000000-0000-0000-0000-000000000001"
DEMO_USERS = [
    (
        "00000000-0000-0000-0000-000000000010",
        "Hiren Chafekar",
        "hiren@taskpulse.io",
        "FrontEnd Engineer",
        4.0,
    ),
    (
        "00000000-0000-0000-0000-000000000011",
        "Prerana Shukla",
        "prerana@taskpulse.io",
        "Backend Engineer",
        3.0,
    ),
    (
        "00000000-0000-0000-0000-000000000012",
        "Anisha Kumari",
        "anisha@taskpulse.io",
        "FrontEnd Engineer",
        1.0,
    ),
    (
        "00000000-0000-0000-0000-000000000013",
        "Gowtham L",
        "gowtham@taskpulse.io",
        "Intern",
        0.5,
    ),
]


def seed_demo_data(db: Database) -> None:
    if not find_team_by_id(db, DEMO_TEAM_ID):
        insert_team(db, {"_id": DEMO_TEAM_ID, "name": "Product Team"})

    demo_ids = []
    for user_id, name, email, role, experience_years in DEMO_USERS:
        demo_ids.append(user_id)
        db.users.replace_one(
            {"_id": user_id},
            {
                "_id": user_id,
                "name": name,
                "email": email,
                "team_id": DEMO_TEAM_ID,
                "role": role,
                "experience_years": experience_years,
            },
            upsert=True,
        )

    db.users.delete_many({"team_id": DEMO_TEAM_ID, "_id": {"$nin": demo_ids}})

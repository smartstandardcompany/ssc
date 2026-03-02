from motor.motor_asyncio import AsyncIOMotorClient
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from fastapi import Depends, HTTPException
# Fix bcrypt 4.x compat with passlib - suppress passlib's logger warning
import warnings
import logging
warnings.filterwarnings("ignore", message=".*bcrypt.*__about__.*")
logging.getLogger("passlib.handlers.bcrypt").setLevel(logging.ERROR)
from passlib.context import CryptContext
from jose import JWTError, jwt
from datetime import datetime, timezone, timedelta
from pathlib import Path
from dotenv import load_dotenv
import os

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

mongo_url = os.environ.get('MONGO_URL', 'mongodb://localhost:27017')
db_name = os.environ.get('DB_NAME', 'ssc_track')
client = AsyncIOMotorClient(mongo_url, serverSelectionTimeoutMS=15000, connectTimeoutMS=15000)
db = client[db_name]

pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")
security = HTTPBearer()

SECRET_KEY = os.environ.get("JWT_SECRET_KEY", "your-secret-key-change-in-production")
ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_MINUTES = 10080

def hash_password(password: str) -> str:
    return pwd_context.hash(password)

def verify_password(plain_password: str, hashed_password: str) -> bool:
    return pwd_context.verify(plain_password, hashed_password)

def create_access_token(data: dict):
    to_encode = data.copy()
    expire = datetime.now(timezone.utc) + timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
    to_encode.update({"exp": expire})
    return jwt.encode(to_encode, SECRET_KEY, algorithm=ALGORITHM)

async def get_current_user(credentials: HTTPAuthorizationCredentials = Depends(security)):
    from models import User
    token = credentials.credentials
    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        user_id: str = payload.get("sub")
        if user_id is None:
            raise HTTPException(status_code=401, detail="Invalid authentication credentials")
    except JWTError:
        raise HTTPException(status_code=401, detail="Invalid authentication credentials")
    
    # First check users collection
    user = await db.users.find_one({"id": user_id}, {"_id": 0})
    if user is None:
        # For cashier PIN login - check employees collection and create virtual user
        employee = await db.employees.find_one({"id": user_id}, {"_id": 0})
        if employee:
            # Generate a valid placeholder email if not provided
            emp_email = employee.get("email", "") or f"cashier.{employee['id'][:8]}@example.com"
            user = {
                "id": employee["id"],
                "email": emp_email,
                "name": employee.get("name", "Cashier"),
                "role": "cashier",
                "branch_id": employee.get("branch_id"),
                "permissions": {"cashier": "write", "pos": "write", "sales": "write"},
                "created_at": employee.get("created_at", datetime.now(timezone.utc).isoformat())
            }
        else:
            raise HTTPException(status_code=401, detail="User not found")
    return User(**user)



def normalize_permissions(perms):
    """Convert old list format to new dict format for backward compatibility.
    
    Old format: ["sales", "expenses", "reports"]
    New format: {"sales": "write", "expenses": "read", "reports": "none"}
    """
    if isinstance(perms, list):
        return {p: "write" for p in perms}
    if isinstance(perms, dict):
        return perms
    return {}


def has_permission(user, module, level="read"):
    """Check if user has permission for a module at the given level.
    
    Args:
        user: User object with role and permissions
        module: Module name (e.g., "sales", "expenses")
        level: Required access level ("read" or "write")
    
    Returns:
        bool: True if user has the required permission level
    """
    # Admins have full access to everything
    if user.role == "admin":
        return True
    
    perms = normalize_permissions(user.permissions)
    user_level = perms.get(module, "none")
    
    if user_level == "none":
        return False
    if level == "read":
        return user_level in ("read", "write")
    if level == "write":
        return user_level == "write"
    return False


def get_branch_filter(user, branch_field="branch_id"):
    """Return a MongoDB query filter for branch-restricted users.
    
    Args:
        user: User object with role and branch_id
        branch_field: The field name to filter on (default: "branch_id")
    
    Returns:
        dict: MongoDB query filter, empty dict for admins/unrestricted users
    """
    if user.role == "admin":
        return {}
    if user.branch_id:
        return {branch_field: user.branch_id}
    return {}


def get_branch_filter_with_global(user, branch_field="branch_id"):
    """Return a MongoDB query filter that includes branch-specific AND global (no branch) items.
    
    Use this for entities like suppliers that can be "all branches" (no branch assigned).
    
    Args:
        user: User object with role and branch_id
        branch_field: The field name to filter on (default: "branch_id")
    
    Returns:
        dict: MongoDB query filter including items with no branch
    """
    if user.role == "admin":
        return {}
    if user.branch_id:
        return {"$or": [
            {branch_field: user.branch_id},
            {branch_field: None},
            {branch_field: ""},
            {branch_field: {"$exists": False}}
        ]}
    return {}


def require_permission(user, module, level="read"):
    """Raise HTTPException if user lacks the required permission.
    
    Args:
        user: User object
        module: Module name
        level: Required access level
    
    Raises:
        HTTPException: 403 if permission denied
    """
    if not has_permission(user, module, level):
        from fastapi import HTTPException
        action = "modify" if level == "write" else "access"
        raise HTTPException(
            status_code=403, 
            detail=f"Permission denied: You don't have {level} access to {module}"
        )

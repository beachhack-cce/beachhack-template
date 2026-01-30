from pydantic import BaseModel
from typing import List, Optional

class TokenRequest(BaseModel):
    token: str

class UserResponse(BaseModel):
    login: str
    id: int
    avatar_url: str
    name: str | None = None
    access_token: str | None = None

class RepoSelectRequest(BaseModel):
    owner: str
    repo: str

class WorkflowStep(BaseModel):
    name: str
    id: str
    # params: Optional[dict] = {} 

class PipelineGenerateRequest(BaseModel):
    steps: List[str] # List of step IDs like "checkout", "install_deps"

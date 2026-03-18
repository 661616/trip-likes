from fastapi import HTTPException


class NotFoundError(HTTPException):
    """Resource not found (404)."""

    def __init__(self, resource: str = "Resource", resource_id: int | str = ""):
        detail = f"{resource} not found"
        if resource_id:
            detail = f"{resource} with id={resource_id} not found"
        super().__init__(status_code=404, detail=detail)


class BadRequestError(HTTPException):
    """Client sent an invalid request (400)."""

    def __init__(self, detail: str = "Bad request"):
        super().__init__(status_code=400, detail=detail)


class LLMServiceError(HTTPException):
    """LLM API call failed (502)."""

    def __init__(self, detail: str = "LLM service unavailable"):
        super().__init__(status_code=502, detail=detail)

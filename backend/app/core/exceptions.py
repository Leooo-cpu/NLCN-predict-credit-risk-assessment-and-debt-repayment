from fastapi import FastAPI, Request
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse
from starlette.exceptions import HTTPException as StarletteHTTPException


class AppError(Exception):
    def __init__(self, message: str, status_code: int = 400, code: str = "APP_ERROR"):
        self.message = message
        self.status_code = status_code
        self.code = code
        super().__init__(message)


class UnauthorizedError(AppError):
    def __init__(self, message: str = "Chưa xác thực"):
        super().__init__(message, 401, "UNAUTHORIZED")


class ForbiddenError(AppError):
    def __init__(self, message: str = "Không có quyền thực hiện thao tác này"):
        super().__init__(message, 403, "FORBIDDEN")


class NotFoundError(AppError):
    def __init__(self, message: str = "Không tìm thấy dữ liệu"):
        super().__init__(message, 404, "NOT_FOUND")


def register_exception_handlers(app: FastAPI) -> None:
    @app.exception_handler(AppError)
    async def app_error_handler(_request: Request, exc: AppError):
        return JSONResponse(
            status_code=exc.status_code,
            content={"detail": exc.message, "code": exc.code},
        )

    @app.exception_handler(StarletteHTTPException)
    async def http_error_handler(_request: Request, exc: StarletteHTTPException):
        return JSONResponse(
            status_code=exc.status_code,
            content={"detail": exc.detail, "code": "HTTP_ERROR"},
        )

    @app.exception_handler(RequestValidationError)
    async def validation_handler(_request: Request, exc: RequestValidationError):
        return JSONResponse(
            status_code=422,
            content={"detail": exc.errors(), "code": "VALIDATION_ERROR"},
        )

    @app.exception_handler(Exception)
    async def unhandled_handler(_request: Request, exc: Exception):
        return JSONResponse(
            status_code=500,
            content={"detail": "Lỗi hệ thống. Vui lòng thử lại sau.", "code": "INTERNAL_ERROR"},
        )

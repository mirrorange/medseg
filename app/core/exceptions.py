from typing import Any


class AppError(Exception):
    """
    Base class for application-specific exceptions.
    """

    def __init__(
        self,
        error_code: int,
        message_key: str,
        status_code: int,
        context: dict[str, Any] | None = None,
        retryable: bool = False,
    ):
        self.error_code = error_code
        self.message_key = message_key
        self.status_code = status_code
        self.context = context if context is not None else {}
        self.retryable = retryable
        super().__init__(
            f"Error Code: {error_code}, "
            f"Message Key: {message_key}, "
            f"Context: {self.context}"
        )

    def __str__(self):
        return (
            f"{self.__class__.__name__}("
            f"error_code={self.error_code}, "
            f"message_key='{self.message_key}', "
            f"status_code={self.status_code}, "
            f"context={self.context})"
        )


class InternalServerError(AppError):
    def __init__(self, context: dict[str, Any] | None = None):
        super().__init__(
            error_code=500000,
            message_key="global.internalServerError",
            status_code=500,
            context=context,
        )


class InvalidCredentials(AppError):
    def __init__(self):
        super().__init__(
            error_code=400001,
            message_key="auth.invalidCredentials",
            status_code=401,
        )


class TokenExpired(AppError):
    def __init__(self):
        super().__init__(
            error_code=400002,
            message_key="auth.tokenExpired",
            status_code=401,
        )


class PermissionDenied(AppError):
    def __init__(self):
        super().__init__(
            error_code=400003,
            message_key="auth.permissionDenied",
            status_code=403,
        )


class UserAlreadyExists(AppError):
    def __init__(self, context: dict[str, Any] | None = None):
        super().__init__(
            error_code=401001,
            message_key="user.alreadyExists",
            status_code=409,
            context=context,
        )


class UserNotFound(AppError):
    def __init__(self):
        super().__init__(
            error_code=401002,
            message_key="user.notFound",
            status_code=404,
        )


class TaskNotFound(AppError):
    def __init__(self):
        super().__init__(
            error_code=404004,
            message_key="task.notFound",
            status_code=404,
        )


class TaskNotCancellable(AppError):
    def __init__(self):
        super().__init__(
            error_code=404005,
            message_key="task.notCancellable",
            status_code=409,
        )


class ModuleNotAvailable(AppError):
    def __init__(self):
        super().__init__(
            error_code=404006,
            message_key="task.moduleNotAvailable",
            status_code=400,
        )

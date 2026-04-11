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

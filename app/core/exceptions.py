from typing import Optional, Any, Dict


class AppError(Exception):
    """
    Base class for application-specific exceptions.
    """

    def __init__(
        self,
        error_code: int,
        message_key: str,
        status_code: int,
        context: Optional[Dict[str, Any]] = None,
        retryable: bool = False,
    ):
        self.error_code = error_code
        self.message_key = message_key
        self.status_code = status_code
        self.context = context if context is not None else {}
        self.retryable = retryable
        super().__init__(
            f"Error Code: {error_code}, Message Key: {message_key}, Context: {self.context}"
        )

    def __str__(self):
        return f"{self.__class__.__name__}(error_code={self.error_code}, message_key='{self.message_key}', status_code={self.status_code}, context={self.context})"


class InternalServerError(AppError):
    def __init__(self, context: Optional[Dict[str, Any]] = None):
        super().__init__(
            error_code=500000,
            message_key="global.internalServerError",
            status_code=500,
            context=context,
        )

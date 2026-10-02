class PermanentEmailError(Exception):
    """The provider rejected the message for good (e.g. invalid recipient): don't retry."""

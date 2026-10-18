export function requireAuth(req, res, next) {
  if (!req.session?.userId) {
    return res.status(401).json({
      status: "Error",
      message: "Silakan masuk terlebih dahulu.",
    });
  }

  req.userId = req.session.userId;
  next();
}

export function verificarRol(...roles) {
  return (req, res, next) => {
    if (!req.session.user) return res.redirect('/');
    if (!roles.includes(req.session.user.rol)) return res.redirect('/');
    next();
  };
}

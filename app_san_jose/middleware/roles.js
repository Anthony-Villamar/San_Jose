//Middleware para verificar el rol del usuario antes de permitir el acceso a ciertas rutas.
export function verificarRol(...roles) {
  return (req, res, next) => {
    if (!req.session.user) return res.redirect('/');
    if (!roles.includes(req.session.user.rol)) return res.redirect('/');
    next();
  };
}

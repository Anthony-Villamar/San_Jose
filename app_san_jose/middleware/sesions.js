// Middleware para verificar si el usuario tiene una sesión activa
export function verificarSesion(req, res, next) {
  if (!req.session.user) {
    return res.redirect('/');
  }
  next();
}

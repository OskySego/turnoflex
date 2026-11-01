import { Usuario } from '../models/Usuario.js';

export class AuthController {

  // ============================================================
  // MOSTRAR LOGIN
  // ============================================================

  static getLogin(req, res) {

    return res.render('auth/login', {
      tituloPage: 'Iniciar Sesión - TurnoFlex',
      error: null
    });

  }


  // ============================================================
  // PROCESAR LOGIN
  // ============================================================

  static async postLogin(req, res) {

    try {

      const { email, password } = req.body;


      // ----------------------------------------------------------
      // Validación básica
      // ----------------------------------------------------------

      if (!email || !password) {

        return res.render('auth/login', {
          tituloPage: 'Iniciar Sesión',
          error: 'Debés ingresar correo electrónico y contraseña.'
        });

      }


      // ----------------------------------------------------------
      // Buscar usuario
      // ----------------------------------------------------------

      const usuario = await Usuario.findOne({
        email: email.trim()
      });


      if (!usuario) {

        return res.render('auth/login', {
          tituloPage: 'Iniciar Sesión',
          error: 'Credenciales inválidas.'
        });

      }


      // ----------------------------------------------------------
      // Verificar contraseña
      // ----------------------------------------------------------

      const esPasswordValida =
        await usuario.compararPassword(password);


      if (!esPasswordValida) {

        return res.render('auth/login', {
          tituloPage: 'Iniciar Sesión',
          error: 'Credenciales inválidas.'
        });

      }


      // ----------------------------------------------------------
      // IMPORTANTE:
      // Regeneramos la sesión después de autenticar correctamente.
      // ----------------------------------------------------------

      await new Promise((resolve, reject) => {

        req.session.regenerate((error) => {

          if (error) {
            return reject(error);
          }

          resolve();

        });

      });


      // ----------------------------------------------------------
      // Guardamos solamente los datos necesarios
      // ----------------------------------------------------------

      req.session.usuario = {

        id: usuario._id,

        nombre: usuario.nombre,

        email: usuario.email,

        rol: usuario.rol

      };


      // ----------------------------------------------------------
      // IMPORTANTE:
      // Esperamos que Express guarde realmente la sesión
      // ANTES de redireccionar.
      // ----------------------------------------------------------

      await new Promise((resolve, reject) => {

        req.session.save((error) => {

          if (error) {
            return reject(error);
          }

          resolve();

        });

      });


      console.log(
        `✅ Login correcto: ${usuario.email} | Rol: ${usuario.rol}`
      );


      // ----------------------------------------------------------
      // Ahora sí redireccionamos
      // ----------------------------------------------------------

      return res.redirect('/');


    } catch (error) {

      console.error(
        '❌ Error en login:',
        error
      );


      return res
        .status(500)
        .render('auth/login', {

          tituloPage:
            'Iniciar Sesión',

          error:
            'Error en el servidor: ' +
            error.message

        });

    }

  }


  // ============================================================
  // MOSTRAR REGISTRO
  // ============================================================

  static getRegister(req, res) {

    return res.render('auth/register', {

      tituloPage:
        'Registro - TurnoFlex',

      error: null

    });

  }


  // ============================================================
  // PROCESAR REGISTRO
  // ============================================================

  static async postRegister(req, res) {

    try {

      const {
        nombre,
        email,
        password
      } = req.body;


      // ----------------------------------------------------------
      // Verificar usuario existente
      // ----------------------------------------------------------

      const existeUsuario =
        await Usuario.findOne({
          email: email.trim()
        });


      if (existeUsuario) {

        return res.render(
          'auth/register',
          {

            tituloPage:
              'Registro',

            error:
              'El correo electrónico ya está registrado.'

          }
        );

      }


      // ----------------------------------------------------------
      // Crear usuario
      // ----------------------------------------------------------

      const nuevoUsuario =
        await Usuario.create({

          nombre,

          email: email.trim(),

          password

        });


      // ----------------------------------------------------------
      // Regenerar sesión
      // ----------------------------------------------------------

      await new Promise(
        (resolve, reject) => {

          req.session.regenerate(
            (error) => {

              if (error) {
                return reject(error);
              }

              resolve();

            }
          );

        }
      );


      // ----------------------------------------------------------
      // Iniciar sesión automáticamente
      // ----------------------------------------------------------

      req.session.usuario = {

        id: nuevoUsuario._id,

        nombre: nuevoUsuario.nombre,

        email: nuevoUsuario.email,

        rol: nuevoUsuario.rol

      };


      // ----------------------------------------------------------
      // Guardar sesión antes del redirect
      // ----------------------------------------------------------

      await new Promise(
        (resolve, reject) => {

          req.session.save(
            (error) => {

              if (error) {
                return reject(error);
              }

              resolve();

            }
          );

        }
      );


      return res.redirect('/');


    } catch (error) {

      console.error(
        '❌ Error en registro:',
        error
      );


      return res
        .status(500)
        .render(
          'auth/register',
          {

            tituloPage:
              'Registro',

            error:
              'Error al registrar: ' +
              error.message

          }
        );

    }

  }


  // ============================================================
  // CERRAR SESIÓN
  // ============================================================

  static logout(req, res) {

    req.session.destroy(
      (error) => {

        if (error) {

          console.error(
            '❌ Error al cerrar sesión:',
            error
          );

          return res.redirect('/');

        }


        res.clearCookie(
          'connect.sid',
          {
            path: '/'
          }
        );


        return res.redirect(
          '/auth/login'
        );

      }
    );

  }

}

export default AuthController;
import { Usuario } from '../models/Usuario.js';

export class AuthController {

  // ============================================================
  // MOSTRAR VISTA DE LOGIN
  // ============================================================

  // Renderizo la pantalla de inicio de sesión de TurnoFlex
  static getLogin(req, res) {

    return res.render('auth/login', {
      tituloPage: 'Iniciar Sesión - TurnoFlex',
      error: null
    });

  }


  // ============================================================
  // PROCESAR CREDENCIALES (POST LOGIN)
  // ============================================================

  static async postLogin(req, res) {

    try {

      const email = String(req.body.email ?? '')
        .trim()
        .toLowerCase();

      const password = String(req.body.password ?? '');


      // ----------------------------------------------------------
      // Validación básica
      // ----------------------------------------------------------
      // Me aseguro de que no manden campos vacíos antes de consultar la DB
      if (!email || !password) {

        return res.render('auth/login', {
          tituloPage: 'Iniciar Sesión',
          error: 'Debés ingresar correo electrónico y contraseña.'
        });

      }


      // ----------------------------------------------------------
      // Buscar usuario
      // ----------------------------------------------------------
      // Busco al usuario contemplando si se loguea con su mail personal o con el institucional
      const usuario = await Usuario.findOne({
        $or: [
          { email },
          { emailInstitucional: email }
      ]
    });


      // Cuentas de seguridad: bloqueo si no existe, si está inactivo o si fue suspendido por administración
      if (!usuario || usuario.activo === false || usuario.suspendidoAdministrativamente === true) {

        return res.render('auth/login', {
          tituloPage: 'Iniciar Sesión',
          error: 'Credenciales inválidas.'
        });

      }


      // ----------------------------------------------------------
      // Verificar contraseña
      // ----------------------------------------------------------
      // Comparo el hash usando el método que armé en el Schema de Mongoose
      const esPasswordValida =
        await usuario.compararPassword(password);


      if (!esPasswordValida) {

        return res.render('auth/login', {
          tituloPage: 'Iniciar Sesión',
          error: 'Credenciales inválidas.'
        });

      }


      // ----------------------------------------------------------
      // IMPORTANTE (Seguridad de Sesiones):
      // Regeneramos la sesión después de autenticar correctamente 
      // para prevenir ataques de fijación de sesión (Session Fixation).
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
      // Guardamos solamente los datos necesarios en la cookie
      // ----------------------------------------------------------

      req.session.usuario = {

        id: usuario._id,

        nombre: usuario.nombre,

        email: usuario.email,

        rol: usuario.rol

      };


      // ----------------------------------------------------------
      // IMPORTANTE:
      // Esperamos que Express guarde realmente la sesión en el store
      // ANTES de hacer la redirección, evitando condiciones de carrera.
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
      // Redirecciono al home principal del sistema
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
  // MOSTRAR VISTA DE REGISTRO
  // ============================================================

  static getRegister(req, res) {

    return res.render('auth/register', {

      tituloPage:
        'Registro - TurnoFlex',

      error: null

    });

  }


  // ============================================================
  // PROCESAR NUEVO REGISTRO (POST REGISTER)
  // ============================================================

  static async postRegister(req, res) {

    try {

      const {
        nombre,
        email,
        password
      } = req.body;


      // Seguridad institucional: Las identidades @turnoflex.internal solo las crea 
      // el personal autorizado. El autorregistro público no puede acaparar esos dominios.
      if (typeof email === 'string' &&
          email.trim().toLowerCase().endsWith('@turnoflex.internal')) {
        return res.status(400).render('auth/register', {
          tituloPage: 'Registro',
          error: 'Las cuentas institucionales se crean desde administración.'
        });
      }


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
      // Crear usuario en la base de datos
      // ----------------------------------------------------------

      const nuevoUsuario =
        await Usuario.create({

          nombre,

          email: email.trim(),

          password

        });


      // ----------------------------------------------------------
      // Regenerar sesión por seguridad tras registrarse
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
      // Iniciar sesión automáticamente al crear la cuenta
      // ----------------------------------------------------------

      req.session.usuario = {

        id: nuevoUsuario._id,

        nombre: nuevoUsuario.nombre,

        email: nuevoUsuario.email,

        rol: nuevoUsuario.rol

      };


      // ----------------------------------------------------------
      // Guardar sesión antes del redirect final
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
  // CERRAR SESIÓN (LOGOUT)
  // ============================================================

  static logout(req, res) {

    // Destruyo la sesión activa del servidor
    req.session.destroy(
      (error) => {

        if (error) {

          console.error(
            '❌ Error al cerrar sesión:',
            error
          );

          return res.redirect('/');

        }


        // Limpio la cookie de sesión del navegador del cliente
        res.clearCookie(
          'connect.sid',
          {
            path: '/'
          }
        );


        // Mando al usuario de vuelta a la pantalla de login
        return res.redirect(
          '/auth/login'
        );

      }
    );

  }

}

export default AuthController;
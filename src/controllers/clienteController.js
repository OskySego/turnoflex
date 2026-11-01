import { Cliente } from '../models/Cliente.js';


export class ClienteController {

  // ============================================================
  // 1. LISTAR CLIENTES
  // ============================================================

  static async getClientes(req, res) {

    try {

      const clientes =
        await Cliente
          .find()
          .lean({
            virtuals: true
          });


      if (
        req.accepts('json') &&
        !req.accepts('html')
      ) {

        return res.status(200).json({
          status: 'success',
          data: clientes || []
        });

      }


      return res.render(
        'lista-cliente',
        {
          tituloPage:
            'Listado de Clientes',

          clientes:
            clientes || []
        }
      );


    } catch (error) {

      console.error(
        '❌ Error al obtener clientes:',
        error
      );


      return res
        .status(500)
        .send(
          'Error al obtener clientes: ' +
          error.message
        );

    }

  }


  // ============================================================
  // 2. DETALLE DE CLIENTE
  // ============================================================

  static async getDetalleCliente(req, res) {

    try {

      const { id } =
        req.params;


      const cliente =
        await Cliente
          .findById(id)
          .lean({
            virtuals: true
          });


      if (!cliente) {

        return res
          .status(404)
          .render(
            'detalle-cliente',
            {
              tituloPage:
                'Cliente no encontrado',

              error:
                'Cliente no encontrado'
            }
          );

      }


      if (
        req.accepts('json') &&
        !req.accepts('html')
      ) {

        return res
          .status(200)
          .json({
            status: 'success',
            data: cliente
          });

      }


      return res.render(
        'detalle-cliente',
        {
          tituloPage:
            `Detalle de ${cliente.nombre}`,

          cliente
        }
      );


    } catch (error) {

      console.error(
        '❌ Error al obtener cliente:',
        error
      );


      return res
        .status(500)
        .send(
          'Error al obtener el detalle: ' +
          error.message
        );

    }

  }


  // ============================================================
  // 3. CREAR CLIENTE
  // ============================================================

  static async crearCliente(req, res) {

    try {

      const {

        nombre,
        dni,
        fechaNacimiento,
        genero,

        telefono,
        email,

        calle,
        numero,
        localidad,
        provincia,

        empresa,
        numeroAfiliado,
        plan

      } = req.body;


      const nuevoCliente =
        await Cliente.create({

          nombre,

          dni,

          fechaNacimiento,

          genero,

          telefono,

          email,

          domicilio: {
            calle,
            numero,
            localidad,
            provincia
          },

          obraSocial: {
            empresa,
            numeroAfiliado,
            plan
          }

        });


      if (
        req.accepts('json') &&
        !req.accepts('html')
      ) {

        return res
          .status(201)
          .json({
            status: 'success',
            data: nuevoCliente
          });

      }


      return res.redirect(
        '/clientes'
      );


    } catch (error) {

      console.error(
        '❌ Error al crear cliente:',
        error
      );


      return res
        .status(400)
        .send(
          'Error al crear cliente: ' +
          error.message
        );

    }

  }


  // ============================================================
  // 4. MI PERFIL
  // ============================================================

  static async miPerfil(req, res) {

    try {

      const emailUsuario =
        req.session.usuario.email;


      const cliente =
        await Cliente
          .findOne({
            email: emailUsuario
          })
          .lean({
            virtuals: true
          });


      if (!cliente) {

        return res.render(
          'error',
          {
            mensaje:
              'No se encontró su perfil de paciente.'
          }
        );

      }


      return res.render(
        'detalle-mi-perfil',
        {

          tituloPage:
            'Mis Datos Personales',

          cliente,

          mensajeExito:
            req.query.exito || null

        }
      );


    } catch (error) {

      console.error(
        '❌ Error al cargar perfil:',
        error
      );


      return res
        .status(500)
        .send(
          'Error al cargar el perfil.'
        );

    }

  }


  // ============================================================
  // 5. ACTUALIZAR MI PERFIL
  // ============================================================

  static async actualizarMiPerfil(req, res) {

    try {

      const emailUsuario =
        req.session.usuario.email;


      const {

        telefono,
        obraSocial,
        numeroAfiliado,
        plan

      } = req.body;


      const cliente =
        await Cliente.findOne({
          email: emailUsuario
        });


      if (!cliente) {

        return res
          .status(404)
          .send(
            'No se encontró el perfil del paciente.'
          );

      }


      // --------------------------------------------------------
      // TELÉFONO
      // --------------------------------------------------------

      cliente.telefono =
        telefono
          ? String(telefono).trim()
          : cliente.telefono;


      // --------------------------------------------------------
      // COBERTURA
      // Conservamos el objeto y actualizamos solo sus campos.
      // --------------------------------------------------------

      if (!cliente.obraSocial) {
        cliente.obraSocial = {};
      }


      cliente.obraSocial.empresa =
        obraSocial
          ? String(obraSocial).trim()
          : '';


      cliente.obraSocial.numeroAfiliado =
        numeroAfiliado
          ? String(numeroAfiliado).trim()
          : '';


      cliente.obraSocial.plan =
        plan
          ? String(plan).trim()
          : '';


      await cliente.save();


      return res.redirect(
        '/clientes/mi-perfil?exito=Datos+actualizados+correctamente'
      );


    } catch (error) {

      console.error(
        '❌ Error al actualizar perfil:',
        error
      );


      return res
        .status(500)
        .send(
          'Error al actualizar los datos.'
        );

    }

  }


  // ============================================================
  // 6. AGREGAR FAMILIAR
  // ============================================================

  static async agregarFamiliar(req, res) {

    try {

      const emailUsuario =
        req.session.usuario.email;


      const {

        nombreFamiliar,
        dniFamiliar,
        parentesco

      } = req.body;


      const cliente =
        await Cliente.findOne({
          email: emailUsuario
        });


      if (!cliente) {

        return res
          .status(404)
          .send(
            'No se encontró el perfil del paciente.'
          );

      }


      // --------------------------------------------------------
      // EVITAR DUPLICADOS POR DNI
      // --------------------------------------------------------

      const familiares =
        Array.isArray(
          cliente.grupoFamiliar
        )
          ? cliente.grupoFamiliar
          : [];


      const dniNuevo =
        String(
          dniFamiliar || ''
        ).trim();


      const yaExiste =
        familiares.some(
          function (familiar) {

            return (
              familiar &&
              String(
                familiar.dni || ''
              ).trim() === dniNuevo
            );

          }
        );


      if (yaExiste) {

        return res.redirect(
          '/clientes/mi-perfil?exito=Ese+familiar+ya+se+encuentra+registrado'
        );

      }


      cliente.grupoFamiliar.push({

        nombre:
          String(
            nombreFamiliar || ''
          ).trim(),

        dni:
          dniNuevo,

        parentesco:
          String(
            parentesco || ''
          ).trim()

      });


      await cliente.save();


      return res.redirect(
        '/clientes/mi-perfil?exito=Familiar+asociado+correctamente'
      );


    } catch (error) {

      console.error(
        '❌ Error al registrar familiar:',
        error
      );


      return res
        .status(500)
        .send(
          'Error al registrar el familiar.'
        );

    }

  }

}


export default ClienteController;
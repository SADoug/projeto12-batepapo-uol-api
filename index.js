import express, { json } from "express";
import cors from "cors";
import chalk from "chalk";
import joi from "joi"
import { MongoClient } from "mongodb";
import dayjs from "dayjs";
import dotenv from "dotenv"

const app = express();
dotenv.config();
app.use(express.json());
app.use(cors());

const port = process.env.PORT || 5000
//CONEXÃO COM O BANCO DE DADOS
let db = null;
const mongoClient = new MongoClient("mongodb+srv://Douglas:119046137@clusterdoug.oqldb.mongodb.net/ClusterDoug?retryWrites=true&w=majority;");
const promise = mongoClient.connect();
promise.then(response => {
	db = mongoClient.db(process.env.BANCO);
    console.log(chalk.red.bold("Banco conectado"))
});
promise.catch((e) => console.log("Não foi possível realizar a conexão com o banco", e));

//Primeiro post falta realizar a conexão com o banco
app.post("/participants", async (req, res) => {
    const {name} = req.body;
    const lastStatus = Date.now();
    console.log(chalk.yellow.bold(name))
    const userSchema = joi.object({
        name: joi.string().min(1).required(),
        lastStatus: joi.number().required(),
    });
    const validation = userSchema.validate({ name: name, lastStatus: lastStatus }, { abortEarly: false });

    if (validation.error) {
        console.log(validation.error.details)
        return res.status(422).send("Todos os campos são obrigatórios!");
    } 

    try {
        const existeparticipante = await db.collection("participantes").findOne({ name: name });
        if (existeparticipante) {
          return res.sendStatus(409);
        }
    
        await db.collection("participantes").insertOne({ name: name, lastStatus: lastStatus });
        await db.collection("mensagens").insertOne({
          from: name,
          to: 'Todos',
          text: 'entra na sala...',
          type: 'status',
          time: dayjs().format('HH:mm:ss')
        });
    
        res.sendStatus(201);
    
      } catch (e) {
        console.log(e);
        return res.status(500).send("Não foi possível registrar o usuário!", e);
      }
})


//Primeiro Get 
app.get("/participants", async (req, res) => {
	// buscando os participantes
    try {
    const participantes = db.collection("participantes").find().toArray();
		res.send(participantes);
	} catch (e) {
        console.log(e);
        return res.status(500).send("Erro ao obuscar os participantes!", e);
      }
});

//Segundo post agora das mensagens 
app.post("/messages", async (req, res) => {
    const mensagem = req.body; // {to, text, type}
    const mensagemSchema = joi.object({
      to: joi.string().required(),
      text: joi.string().required(),
      type: joi.string().valid('message', 'private_message').required()
    });
    const { error } = mensagemSchema.validate(mensagem, { abortEarly: false });
    if (error) {
      return res.status(422).send(error.details.map(detail => detail.message));
    }

  
    const { user } = req.headers; // from
    try {
      const participant = await db.collection("participantes").findOne({ name: user });
      if (!participant) {
        return res.sendStatus(422);
      }
  
      const { to, text, type } = mensagem;
      await db.collection("mensagens").insertOne({
        to,
        text,
        type,
        from: user,
        time: dayjs().format('HH:mm:ss')
      });
  
      res.sendStatus(201);
  
    } catch (error) {
      return res.status(422).send("Você não existe!");
    }
  });
//Segundo get agora das mensagens 
app.get("/messages", async (req, res) => {
    const limite = parseInt(req.query.limit);
    const { user } = req.headers; //const user = req.header("User");
  
    try {
      const messages = await db.collection("messages").find().toArray();
      const mensagensFiltradas = messages.filter(message => {
        const { from, to, type } = message;
        const para = to === "Todos" || (to === user || from === user);
        const publica = type === "message";
  
        return para || publica; 
      });
  
      if (limite && limite !== NaN) {
        return res.send(mensagensFiltradas.slice(-limite));
      }
  
      res.send(mensagensFiltradas);
    } catch (e) {
      console.log("Erro ao obter mensagens", e);
      res.sendStatus(500);
    }
  
  });
  
//Ultimo post
app.post("/status", async (req, res) => {
    const { user } = req.headers; 
    try {
      const participante = await db.collection("participantes").findOne({ name: user });
      if (!participante) return res.sendStatus(404);
  
      await db.collection("participantes").updateOne({ name: user }, { $set: { lastStatus: Date.now() } });
      res.sendStatus(200);
  
    } catch (e) {
      console.log("Erro ao atualizar status", e);
      res.sendStatus(500)
    }
  });
  
  const TIME_TO_CHECK = 15 * 1000; 
  setInterval(async () => {
    console.log("removendo usuarios");
    const segundos = Date.now() - (10 * 1000); 
    try {
      const  usuarioInativo = await db.collection("participantes").find({ lastStatus: { $lte: segundos } }).toArray();
      if (usuarioInativo.length > 0) {
        const mensagemInativa = usuarioInativo.map(usuarioInativo => {
          return {
            from: usuarioInativo.name,
            to: 'Todos',
            text: 'sai da sala...',
            type: 'status',
            time: dayjs().format("HH:mm:ss")
          }
        });
  
        await db.collection("mensagens").insertMany(mensagemInativa);
        await db.collection("participantes").deleteMany({ lastStatus: { $lte: segundos } });
      }
    } catch (e) {
      console.log("Erro ao remover usuários inativos!", e);
      res.sendStatus(500);
    }
  }, TIME_TO_CHECK);
app.listen(5000, () => {
    console.log(chalk.bold.green(`Servidor em pé na porta 5000`));
})
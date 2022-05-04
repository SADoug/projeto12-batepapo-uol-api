import express, { json } from "express";
import dotenv from "dotenv";
import { MongoClient } from "mongodb";
import joi from "joi";
import dayjs from "dayjs";
import cors from "cors";
import chalk from "chalk";

const app = express();
app.use(json());
app.use(cors());
dotenv.config();
//DB connection
let db = null;
const mongoClient = new MongoClient("mongodb+srv://teste:teste@clusterdoug.oqldb.mongodb.net/ClusterDoug?retryWrites=true&w=majority");
const promise = mongoClient.connect();
promise.then(response => {
	db = mongoClient.db("ClusterDoug");
    console.log(chalk.red.bold("Banco conectado"))
});
promise.catch((e) => console.log(chalk.yellow.bold("Não foi possível realizar a conexão com o banco", e)));

//Firs POST to send the user to the server
app.post("/participants", async (req, res) => {
  const participante = req.body;
  console.log(chalk.yellow.bold(participante.name))
  const userSchema = joi.object({ name: joi.string().min(1).required() });
  const { error } = userSchema.validate(participante); 
  if (error) {
    console.log(error);
    return res.sendStatus(422);
  }

  try {
    const existeparticipante = await db.collection("participants").findOne({ name: participante.name });
    if (existeparticipante) {
      return res.sendStatus(409);
    }

    await db.collection("participants").insertOne({ name: participante.name, lastStatus: Date.now() });
    await db.collection("messages").insertOne({
      from: participante.name,
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

});
//First GET to find all of the collection users
app.get("/participants", async (req, res) => {
  try {
    const participants = await db.collection("participants").find().toArray();
    res.send(participants);
  } catch (e) {
    console.log(e);
    return res.status(500).send("Erro ao obter os participantes!", e);
  }
});
//Second post now send the messages to the cloud
app.post("/messages", async (req, res) => {
  const message = req.body; 
  const messageSchema = joi.object({
    to: joi.string().required(),
    text: joi.string().required(),
    type: joi.string().valid('message', 'private_message').required()
  });
  const { error } = messageSchema.validate(message, { abortEarly: false });
  if (error) {
    return res.status(422).send(error.details.map(detail => detail.message));
  }

  const { user } = req.headers; 
  try {
    const participant = await db.collection("participants").findOne({ name: user });
    if (!participant) {
      return res.sendStatus(422);
    }

    const { to, text, type } = message;
    await db.collection("messages").insertOne({
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

app.get("/messages", async (req, res) => {
  const limit = parseInt(req.query.limit);
  const { user } = req.headers; 

  try {
    const messages = await db.collection("messages").find().toArray();
    const filteredMessages = messages.filter(message => {
      const { from, to, type } = message;
      const toUser = to === "Todos" || (to === user || from === user);
      const isPublic = type === "message";

      return toUser || isPublic; 
    });

    if (limit && limit !== NaN) {
      return res.send(filteredMessages.slice(-limit));
    }

    res.send(filteredMessages);
  } catch (e) {
    console.log("Erro ao obter mensagens", e);
    res.sendStatus(500);
  }

});

app.post("/status", async (req, res) => {
  const { user } = req.headers; 
  try {
    const participant = await db.collection("participants").findOne({ name: user });
    if (!participant) return res.sendStatus(404);

    await db.collection("participants").updateOne({ name: user }, { $set: { lastStatus: Date.now() } });
    res.sendStatus(200);

  } catch (e) {
    console.log("Erro ao atualizar status", e);
    res.sendStatus(500)
  }
});

const TIME_TO_CHECK = 15 * 1000; 
setInterval(async () => {
  console.log("removendo usuarios");
  const seconds = Date.now() - (10 * 1000);
  try {
    const inactiveParticipants = await db.collection("participants").find({ lastStatus: { $lte: seconds } }).toArray();
    if (inactiveParticipants.length > 0) {
      const inativeMessages = inactiveParticipants.map(inactiveParticipant => {
        return {
          from: inactiveParticipant.name,
          to: 'Todos',
          text: 'sai da sala...',
          type: 'status',
          time: dayjs().format("HH:mm:ss")
        }
      });

      await db.collection("messages").insertMany(inativeMessages);
      await db.collection("participants").deleteMany({ lastStatus: { $lte: seconds } });
    }
  } catch (e) {
    console.log("Erro ao remover usuários inativos!", e);
    res.sendStatus(500);
  }
}, TIME_TO_CHECK);

const port = process.env.PORT || 5000;
app.listen(port, () => {
  console.log(`O servidor está na porta ${port}`);
});

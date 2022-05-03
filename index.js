import express, { json } from "express";
import cors from "cors";
import chalk from "chalk";
import joi from "joi"
import { MongoClient } from "mongodb";
import dayjs from "dayjs";

const app = express();
app.use(express.json());
app.use(cors());

//CONEXÃO COM O BANCO DE DADOS
let db = null;
const mongoClient = new MongoClient("mongodb://localhost:27017");
const promise = mongoClient.connect();
promise.then(response => {
	db = mongoClient.db("banco");
    console.log(chalk.red.bold("Banco conectado"))
});

//Primeiro post falta realizar a conexão com o banco
app.post("/participants", (req, res) => {
    const {name} = req.body;
    const lastStatus = Date.now();
    console.log(chalk.yellow.bold(name))
    const userSchema = joi.object({
        name: joi.string().required(),
        lastStatus: joi.number().required(),
    });
    const mensagem = {from: name, to: 'Todos', text: 'entra na sala...', type: 'status', time: dayjs(lastStatus).format("HH:mm:ss")}
    const validation = userSchema.validate({ name: name, lastStatus: lastStatus }, { abortEarly: false });

    if (validation.error) {
        res.status(422).send("Todos os campos são obrigatórios!");
        console.log(validation.error.details)
    } 

    db.collection("participantes").insertOne({ name: name, lastStatus: lastStatus}).then(() => {
        res.status(201).json;
        console.log(chalk.red.bold("Usuario Cadastrado"))
	});
    db.collection("participantes").insertOne({ from: name, to: 'Todos', text: 'entra na sala...', type: 'status', time: dayjs(lastStatus).format("HH:mm:ss") }).then(() => {
        res.status(201).json;
        console.log(chalk.red.bold("Mensagem enviada"))
	});
})


//Primeiro Get 
app.get("/participants", (req, res) => {
	// buscando os participantes
	db.collection("users").find().toArray().then(users => {
		res.send(users);
	});
});

//Segundo post agora das mensagens 
app.post("/messages", (req, res) => {
    const { to, text, type } = req.body; //primeiro requisito
    const { from } = req.user; //segundo requisito: preciso de algo para confirmar?
    const userSchema = joi.object({
        to: joi.string().required(),
        text: joi.string().required(),
        type: joi.string().required(),
        from: joi.string().required()
    });
    const mensagem = {from: from, to: to, text: text, type: type, time: 'HH:mm:ss'}
    const validation = userSchema.validate(user, { abortEarly: false });

    if (validation.error) {
        res.status(422).send("Todos os campos são obrigatórios!");
        console.log(validation.error.details)
    }
    db.collection("users").insertOne(user, mensagem).then(() => {
        console.log("Funcionando")
		res.sendStatus(201);
	});
})

//POST final para atualizar o status
app.post("/participants", (req, res) => {
    const userHeader = req.headers.user;
    db.collection("users").find().toArray().then(users => {
        users.name === userHeader
    });
    res.sendStatus(200);
})

app.listen(5000, () => {
    console.log(chalk.bold.green(`Servidor em pé na porta 5000`));
})
import express from "express";
import cors from "cors";
import chalk from "chalk";
import joi from "joi"
import { MongoClient } from "mongodb";

const app = express();
app.use(express.json());
app.use(cors());

//CONEXÃO COM O BANCO DE DADOS
let db;
const mongoClient = new MongoClient("mongodb+srv://Douglas:qtGZ6YH63@Eq9tT@clusterdoug.oqldb.mongodb.net/ClusterDoug?retryWrites=true&w=majority");


mongoClient.connect().then(() => {
	db = mongoClient.db("meu_lindo_projeto");
});

app.post("/participants", (req, res) => {
    const nome = req.body.name;
    console.log(nome)
    const userSchema = joi.object({
        name: joi.string().required(),
    });
    const user = { name: nome,  lastStatus: Date.now() }
    const mensagem = {from: user.name, to: 'Todos', text: 'entra na sala...', type: 'status', time: 'HH:mm:ss'}
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
app.get("/participants", (req, res) => {
	// buscando os participantes
	db.collection("users").find().toArray().then(users => {
		res.send(users);
	});
});




app.listen(5000, () => {
    console.log(chalk.bold.green(`Servidor em pé na porta 5000`));
})
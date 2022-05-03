import express from "express";
import { MongoClient } from "mongodb";

const app = express();
app.use(express.json());

// conectando ao banco
let db;
const mongoClient = new MongoClient("mongodb://localhost:27017");

mongoClient.connect().then(() => {
	db = mongoClient.db("meu_lindo_projeto");
});

app.get("/recipes", (req, res) => {
	// buscando receitas
	db.collection("recipes").find().toArray().then(recipes => {
		res.send(recipes);
	});
});

app.post("/recipes", (req, res) => {
	// inserindo receita
	db.collection("recipes").insertOne(req.body).then(() => {
		res.sendStatus(201);
	});
});

app.listen(5500);
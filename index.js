const { MongoClient, ServerApiVersion } = require('mongodb');
const express = require("express");
const cors = require("cors");
const jwt = require('jsonwebtoken')
const cookieParser = require('cookie-parser')
require("dotenv").config();
const PORT = process.env.PORT || 8000;

const app = express();

app.use(cors());

app.use(express.json());

app.use(cookieParser());

app.get("/", (req, res) => {
  res.send("Hello World");
});

app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});





const username = process.env.DB_USERNAME;
const password = process.env.DB_PASSWORD;


const uri = `mongodb+srv://${username}:${password}@cluster0.fvuhgjn.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0`;

// Create a MongoClient with a MongoClientOptions object to set the Stable API version
const client = new MongoClient(uri, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  }
});

async function run() {
  try {
    // Connect the client to the server	(optional starting in v4.7)

    const db = client.db('m-12')
    const bioDatasCollection = db.collection('bioDatas')

    // get all the bioDatas
    app.get('/bioDatas', async (req, res) => {
      const bioDatas = await bioDatasCollection.find().toArray();
      res.send(bioDatas);
    })

    app.get('/stats', async (req, res) => {
      try {
        const totalBioDatas = await bioDatasCollection.countDocuments();
        const totalGirls = await bioDatasCollection.countDocuments({ biodataType: 'Female' });
        const totalBoys = await bioDatasCollection.countDocuments({ biodataType: 'Male' });
        const totalMarriages = await bioDatasCollection.countDocuments({ marriageCompleted: true });
        res.send({ totalBioDatas, totalGirls, totalBoys, totalMarriages });
      } catch (error) {
        res.status(500).send({ error: 'Failed to fetch stats' });
      }
    });

    // await client.connect();
    // Send a ping to confirm a successful connection
    await client.db("admin").command({ ping: 1 });
    console.log("Pinged your deployment. You successfully connected to MongoDB!");
  } finally {
    // Ensures that the client will close when you finish/error
    // await client.close();
  }
}
run().catch(console.dir);


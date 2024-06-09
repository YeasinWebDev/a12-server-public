const { MongoClient, ServerApiVersion, ObjectId } = require("mongodb");
require("dotenv").config();
const express = require("express");
const cors = require("cors");
const jwt = require("jsonwebtoken");
const Stripe = require("stripe");
const stripe = Stripe(process.env.STRIPE_KEY);
const cookieParser = require("cookie-parser");
const PORT = process.env.PORT || 8000;

const app = express();

const corsOptions = {
  origin: "http://localhost:5173",
  credentials: true,
};

app.use(cors(corsOptions));

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
  },
});

// Verify Token Middleware
const verifyToken = async (req, res, next) => {
  const token = req.cookies?.token;
  if (!token) {
    return res.status(401).send({ message: "unauthorized access" });
  }
  jwt.verify(token, process.env.ACCESS_TOKEN, (err, decoded) => {
    if (err) {
      console.log(err);
      return res.status(401).send({ message: "unauthorized access" });
    }
    req.user = decoded;
    next();
  });
};

async function run() {
  try {
    // Connect the client to the server	(optional starting in v4.7)

    const db = client.db("m-12");
    const bioDatasCollection = db.collection("bioDatas");
    const successStoriesCollection = db.collection("successStories");
    const userCollection = db.collection("user");
    const paymentCollection = db.collection("payment");
    const makePremiumCollection = db.collection("makePremium");
    const favouritesCollection = db.collection("favourites");

    // jwt
    app.post("/jwt", async (req, res) => {
      const user = req.body;
      const token = jwt.sign(user, process.env.ACCESS_TOKEN, {
        expiresIn: "1hr",
      });

      res
        .cookie("token", token, {
          httpOnly: true,
          secure: process.env.NODE_ENV === "production",
          sameSite: process.env.NODE_ENV === "production" ? "none" : "strict",
        })
        .send({ success: true });
    });

    // get all the bioDatas
    app.get("/bioDatas", async (req, res) => {
      const bioDatas = await bioDatasCollection.find().toArray();
      res.send(bioDatas);
    });

    // get by bioData_id
    app.get("/bioDatasbyId", verifyToken, async (req, res) => {
      const biodata_id = req.query.id;
      const bioData = await bioDatasCollection.findOne({
        biodata_id: biodata_id,
      });
      res.send(bioData);
    });

    // get req by email in dashboard
    app.get("/dashboardBiodata", verifyToken, async (req, res) => {
      const Email = req.query.contactEmail;
      const bioData = await bioDatasCollection.findOne({ contactEmail: Email });

      const status = await makePremiumCollection.findOne({
        biodataId: bioData?.biodata_id,
      });
      res.send({ bioData, status });
    });
    // dashboard biodata page
    app.put("/bioDatas", verifyToken, async (req, res) => {
      try {
        const bioData = req.body;
        const filter = { contactEmail: bioData.contactEmail };

        // Find the last biodata entry and determine the new biodata_id
        const lastBioData = await bioDatasCollection
          .find()
          .sort({ biodata_id: -1 })
          .limit(0)
          .toArray();
        console.log("last data", lastBioData);

        const newBiodataId =
          lastBioData.length > 0 ? parseInt(lastBioData[0].biodata_id) + 1 : 1;
        console.log("number", newBiodataId);

        // Construct the update document
        const updateDoc = {
          $set: {
            name: bioData.name,
            biodata_id: newBiodataId,
            biodataType: bioData.biodataType,
            profileImage: bioData.profileImage,
            fathersName: bioData.fathersName,
            mothersName: bioData.mothersName,
            dateOfBirth: bioData.dateOfBirth,
            height: bioData.height,
            weight: bioData.weight,
            age: bioData.age,
            occupation: bioData.occupation,
            race: bioData.race,
            permanentDivision: bioData.permanentDivision,
            presentDivision: bioData.presentDivision,
            expectedPartnerAge: bioData.expectedPartnerAge,
            expectedPartnerHeight: bioData.expectedPartnerHeight,
            expectedPartnerWeight: bioData.expectedPartnerWeight,
            contactEmail: bioData.contactEmail,
            mobileNumber: bioData.mobileNumber,
            premium: "false",
          },
        };

        // Upsert the biodata document
        const option = { upsert: true };
        const result = await bioDatasCollection.updateOne(
          filter,
          updateDoc,
          option
        );

        // Send the result
        res.send(result);
      } catch (error) {
        console.error("Error updating biodata:", error);
        res.status(500).send({ error: "Failed to update biodata" });
      }
    });

    // get req for single bioData
    app.get("/bioDatas/:id", verifyToken, async (req, res) => {
      const id = req.params.id;
      const bioData = await bioDatasCollection.findOne({
        _id: new ObjectId(id),
      });
      res.send(bioData);
    });

    // get req by email
    app.get("/bioDatasbyEmail", verifyToken, async (req, res) => {
      const Email = req.query.contactEmail;
      const bioData = await bioDatasCollection.findOne({ contactEmail: Email });
      res.send(bioData);
    });

    // get req for related bioData
    app.get("/relatedData", async (req, res) => {
      const biodataType = req.query.biodataType;
      const bioData = await bioDatasCollection
        .find({
          biodataType,
        })
        .toArray();
      res.send(bioData);
    });

    app.get("/stats", async (req, res) => {
      try {
        const totalBioDatas = await bioDatasCollection.countDocuments();
        const totalGirls = await bioDatasCollection.countDocuments({
          biodataType: "Female",
        });
        const totalBoys = await bioDatasCollection.countDocuments({
          biodataType: "Male",
        });
        const totalMarriages = await bioDatasCollection.countDocuments({
          marriageCompleted: true,
        });
        res.send({ totalBioDatas, totalGirls, totalBoys, totalMarriages });
      } catch (error) {
        res.status(500).send({ error: "Failed to fetch stats" });
      }
    });

    // dashboard make premium req
    app.post("/makePremium", async (req, res) => {
      const data = req.body;
      const result = await makePremiumCollection.insertOne(data);
      res.send(result);
    });

    app.get("/makePremium", async (req, res) => {
      const result = await makePremiumCollection.find().toArray();
      res.send(result);
    });

    app.put("/makePremium", async (req, res) => {
      const { email } = req.body;
      console.log(email);
      const result = await makePremiumCollection.updateOne(
        { email },
        { $set: { status: "accepted" } }
      );
      const result2 = await bioDatasCollection.updateOne(
        { contactEmail: email },
        { $set: { premium: "true" } }
      );
      res.send(result);
    });

    // dashboard Favourites
    app.post("/favourites", verifyToken, async (req, res) => {
      const data = req.body;
      const result = await favouritesCollection.insertOne(data);
      res.send(result);
    });

    app.get("/favourites", verifyToken, async (req, res) => {
      const email = req.query.email;
      const result = await favouritesCollection.find({ user: email }).toArray();
      res.send(result);
    });

    app.get("/favouritesbyId", verifyToken, async (req, res) => {
      const id = req.query.id;
      const result = await favouritesCollection.findOne({ biodataId: id });
      res.send(result);
    });

    app.delete("/favourites", verifyToken, async (req, res) => {
      const id = req.query.id;
      const result = await favouritesCollection.deleteOne({ biodataId: id });
      res.send(result);
    });

    // success story collection
    app.get("/successStories", async (req, res) => {
      const successStories = await successStoriesCollection.find().toArray();
      res.send(successStories);
    });

    // save user
    app.put("/user", async (req, res) => {
      try {
        const user = req.body;
        const isExist = await userCollection.findOne({ email: user.email });
        if (isExist) return;
        const query = { email: user.email };
        const option = { upsert: true };
        const updateDoc = {
          $set: user,
        };

        // Perform the upsert operation
        const result = await userCollection.updateOne(query, updateDoc, option);

        // Send the result back to the client
        res.send(result);
      } catch (error) {
        console.error("Error updating user:", error);
        res
          .status(500)
          .send({ error: "An error occurred while updating the user" });
      }
    });

    app.get("/user", async (req, res) => {
      const email = req.query.email;
      try {
        const user = await userCollection.findOne({ email: email });
        res.send(user);
      } catch (error) {
        console.error("Error finding user:", error);
        res.status(500).send("Internal Server Error");
      }
    });

    // admin dashboard
    app.get("/DashbordStats", verifyToken, async (req, res) => {
      try {
        const totalBioDatas = await bioDatasCollection.countDocuments();
        const totalGirls = await bioDatasCollection.countDocuments({
          biodataType: "Female",
        });
        const totalBoys = await bioDatasCollection.countDocuments({
          biodataType: "Male",
        });

        const premiumBiodata = await bioDatasCollection.countDocuments({
          premium: "true",
        });

        const payments = await paymentCollection.find({}).toArray();
        const totalRevenue = payments.reduce(
          (sum, payment) => sum + payment.price,
          0
        );

        res.send({
          premiumBiodata,
          totalBioDatas,
          totalGirls,
          totalBoys,
          totalRevenue,
        });
      } catch (error) {
        res.status(500).send({ error: "Failed to fetch stats" });
      }
    });

    // manage user dashboard
    app.get("/usersByRole", async (req, res) => {
      const users = await userCollection.find().toArray();
      res.send(users);
    });

    app.put("/updateRole", verifyToken, async (req, res) => {
      const { email } = req.body;
      console.log(email);
      const result = await userCollection.updateOne(
        { email: email },
        { $set: { role: "admin" } }
      );
      res.send(result);
    });

    app.put("/updatePremium", verifyToken, async (req, res) => {
      const { email } = req.body;
      const result = await bioDatasCollection.updateOne(
        { contactEmail: email },
        { $set: { premium: "true" } }
      );
      const result2 = await userCollection.updateOne(
        { email: email },
        { $set: { role: "premium" } }
      );
      res.send(result);
    });

    // payment intent
    app.post("/create-payment-intent", async (req, res) => {
      const { price } = req.body;
      const amount = parseInt(price * 100);

      try {
        const paymentIntent = await stripe.paymentIntents.create({
          amount,
          currency: "usd",
          payment_method_types: ["card"],
        });
        res.send({ clientSecret: paymentIntent.client_secret });
      } catch (error) {
        console.error("Error creating payment intent:", error);
        res.status(500).send({ error: "Failed to create payment intent" });
      }
    });

    app.post("/payment", async (req, res) => {
      const payment = req.body;
      const result = await paymentCollection.insertOne(payment);
      res.send({ result });
    });

    app.get("/payment", async (req, res) => {
      const email = req.query.email;
      const payment = await paymentCollection.find({ user: email }).toArray();
      res.send(payment);
    });

    app.get("/paymentById", async (req, res) => {
      const bioData_id = req.query.biodataId;
      const payment = await paymentCollection.findOne({
        bioDataId: bioData_id,
      });
      res.send(payment);
    });

    app.delete("/payment/:id", async (req, res) => {
      const id = req.params.id;
      const result = await paymentCollection.deleteOne({
        _id: new ObjectId(id),
      });
      res.send(result);
    });

    // await client.connect();
    // Send a ping to confirm a successful connection
    // await client.db("admin").command({ ping: 1 });
    console.log(
      "Pinged your deployment. You successfully connected to MongoDB!"
    );
  } finally {
    // Ensures that the client will close when you finish/error
    // await client.close();
  }
}
run().catch(console.dir);

const express = require("express");
const cors = require("cors");
const jwt = require("jsonwebtoken");
const { MongoClient, ServerApiVersion, ObjectId } = require("mongodb");
require("dotenv").config();
const app = express();
app.use(express.json());
app.use(cors());
const port = process.env.PORT || 5589;

const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@cluster0.bix9lir.mongodb.net/?retryWrites=true&w=majority`;

// Create a MongoClient with a MongoClientOptions object to set the Stable API version

const client = new MongoClient(uri, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  },
});

async function run() {
  try {
    // Connect the client to the server	(optional starting in v4.7)
    // await client.connect();

    const database = client.db("petsDB");
    const categories = database.collection("categories");
    const encourages = database.collection("encourage");
    const users = database.collection("users");
    const pets = database.collection("pets");
    const campaigns = database.collection("campaigns");
    const adoptions = database.collection("adoptions");

    //  jwt
    app.post("/jwt", async (req, res) => {
      const user = req.body;
      const token = jwt.sign(user, process.env.ACCESS_TOKEN_SECRET, {
        expiresIn: "2h",
      });
      res.send({ token });
    });

    // middlewares
    const verifyToken = (req, res, next) => {
      if (!req.headers.authorization) {
        return res.status(401).send({ message: "unauthorized access" });
      }
      const token = req.headers.authorization.split(" ")[1];
      // console.log(token);
      jwt.verify(token, process.env.ACCESS_TOKEN_SECRET, (err, dec) => {
        if (err) {
          return res.status(401).send({ message: "unauthorized access" });
        }
        req.dec = dec;

        next();
      });
    };

    const verifyAdmin = async (req, res, next) => {
      const email = req.dec.email;
      const query = { email: email };
      const user = await users.findOne(query);
      const isAdmin = user?.role === "admin";
      if (!isAdmin) {
        return res.status(403).send({ message: "forbidden access" });
      }
      next();
    };
    // users

    app.get("/users", verifyToken, verifyAdmin, async (req, res) => {
      const result = await users.find().toArray();
      res.send(result);
    });

    app.get("/user/admin/:email", verifyToken, async (req, res) => {
      const email = req.params.email;
      if (email !== req.dec.email) {
        return res.status(403).send({ message: "forbidden access" });
      }

      const query = { email: email };
      const user = await users.findOne(query);
      let admin = false;
      if (user) {
        admin = user?.role === "admin";
      }
      res.send({ admin });
    });

    app.post("/users", async (req, res) => {
      const user = req.body;
      // insert email if does not exist
      const query = { email: user.email };

      const exist = await users.findOne(query);
      if (exist) {
        return res.send({ message: "user already exists", insertedId: null });
      }
      const result = await users.insertOne(user);
      res.send(result);
    });
    app.patch(
      "/users/admin/:id",
      verifyToken,
      verifyAdmin,
      async (req, res) => {
        const id = req.params.id;
        const filter = { _id: new ObjectId(id) };

        const updateRole = {
          $set: {
            role: "admin",
          },
        };

        const result = await users.updateOne(filter, updateRole);
        res.send(result);
      }
    );

    //  Pets

    app.get("/categories", async (req, res) => {
      const result = await categories.find().toArray();
      res.send(result);
    });

    app.get("/encourages", async (req, res) => {
      const result = await encourages.find().toArray();
      res.send(result);
    });
    app.get("/pets", verifyToken, async (req, res) => {
      const filter = req.query;

      const category = filter.category;
      let query = {};
      const options = {
        sort: {
          listed_time: -1,
        },
      };

      if (filter.search || category) {
        query = {
          pet_name: { $regex: filter.search, $options: "i" },
          "pet_category.value": { $regex: category },
        };
      }
      const result = await pets.find(query, options).toArray();
      res.send(result);
    });

    app.get("/pets/mine", verifyToken, async (req, res) => {
      const page = parseInt(req.query.page - 1);
      const size = parseInt(req.query.size);

      let query = {};
      if (req.query?.lister_email) {
        query = { lister_email: req.query.lister_email };
      }
      const result = await pets
        .find(query)
        .skip(page * size)
        .limit(size)
        .toArray();

      res.send(result);
    });
    app.get("/pets/mine/count", verifyToken, async (req, res) => {
      let query = {};
      if (req.query?.lister_email) {
        query = { lister_email: req.query.lister_email };
      }
      const result = await pets.find(query).toArray();

      res.send(result);
    });
    app.get("/pet/:id", verifyToken, async (req, res) => {
      const id = req.params.id;
      const filter = { _id: new ObjectId(id) };
      const result = await pets.findOne(filter);
      res.send(result);
    });
    app.post("/pets", verifyToken, async (req, res) => {
      const pet = req.body;
      const result = await pets.insertOne(pet);
      res.send(result);
    });
    app.patch("/pet/:id", verifyToken, async (req, res) => {
      const id = req.params.id;

      const update = req.body;
      const filter = { _id: new ObjectId(id) };

      const result = await pets.updateOne(filter, {
        $set: update,
      });

      res.send(result);
    });

    app.delete("/pet/:id", verifyToken, async (req, res) => {
      const id = req.params.id;
      const filter = { _id: new ObjectId(id) };

      const result = await pets.deleteOne(filter);
      res.send(result);
    });
    app.get("/pets/adoptions/mine", verifyToken, async (req, res) => {
      let query = {};
      if (req.query?.lister) {
        query = { lister: req.query.lister };
      }
      const result = await adoptions.find(query).toArray();

      res.send(result);
    });
    app.post("/pets/adoptions", verifyToken, async (req, res) => {
      const adoption = req.body;
      const result = await adoptions.insertOne(adoption);
      res.send(result);
    });
    app.patch("/pets/adoption/:id", verifyToken, async (req, res) => {
      const id = req.params.id;

      const update = req.body;
      const filter = { _id: new ObjectId(id) };

      const result = await adoptions.updateOne(filter, {
        $set: update,
      });

      res.send(result);
    });
    // campaign
    app.get("/campaigns/mine", verifyToken, async (req, res) => {
      let query = {};

      if (req.query?.creator) {
        query = { creator: req.query.creator };
      }
      const result = await campaigns.find(query).toArray();

      res.send(result);
    });
    app.get("/campaign/:id", verifyToken, async (req, res) => {
      const id = req.params.id;
      const filter = { _id: new ObjectId(id) };
      const result = await campaigns.findOne(filter);
      res.send(result);
    });
    app.get("/campaigns", verifyToken, async (req, res) => {
      const query ={}
      const result = await campaigns
        .find(query,{ sort: { created_on: -1 } })
        .toArray();
      res.send(result);
    });
    app.post("/campaigns", verifyToken, async (req, res) => {
      const campaign = req.body;
      const result = await campaigns.insertOne(campaign);
      res.send(result);
    });
    app.patch("/campaign/:id", verifyToken, async (req, res) => {
      const id = req.params.id;

      const update = req.body;
      const filter = { _id: new ObjectId(id) };

      const result = await campaigns.updateOne(filter, {
        $set: update,
      });

      res.send(result);
    });
    app.delete("/campaign/:id", verifyToken, async (req, res) => {
      const id = req.params.id;
      const filter = { _id: new ObjectId(id) };

      const result = await campaigns.deleteOne(filter);
      res.send(result);
    });

    // Send a ping to confirm a successful connection
    await client.db("admin").command({ ping: 1 });
    console.log("successfully connected to MongoDB!");
  } finally {
    // Ensures that the client will close when you finish/error
    // await client.close();
  }
}
run().catch(console.dir);

app.get("/", (req, res) => {
  res.send("Hello Guys");
});

app.listen(port, () => {
  console.log(`Running on ${port}`);
});

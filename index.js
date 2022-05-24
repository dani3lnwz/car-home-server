const express = require('express');
const cors = require('cors');
require('dotenv').config();
const { MongoClient, ServerApiVersion, ObjectId } = require('mongodb');
const app = express();
const port = process.env.PORT || 5000;

app.use(cors());
app.use(express.json())

const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@cluster0.7rfww.mongodb.net/?retryWrites=true&w=majority`;

const client = new MongoClient(uri, { useNewUrlParser: true, useUnifiedTopology: true, serverApi: ServerApiVersion.v1 });

async function run(){
    try{
        await client.connect();
        const partCollection = client.db('all-in-one').collection('parts');
        const bookingCollection = client.db('all-in-one').collection('bookings');

        app.get('/part', async(req, res) => {
            const query = {};
            const cursor = partCollection.find(query);
            const parts = await cursor.toArray();
            res.send(parts);
        });

        app.get('/part/:id', async (req, res) => {
            const id = req.params.id;
            const query = { _id: ObjectId(id) };
            const part = await partCollection.findOne(query);
            res.send(part);
        });

        // booking

        app.post('/booking', async(req, res) => {
            const booking = req.body;
            const result = bookingCollection.insertOne(booking);
            res.send(result);
        })

        app.put("/part/:id", async(req, res) => {
            const id = req.params.id;
            // console.log(id)
            const purchase = req.body;
            const filter = { _id: ObjectId(id) };
            const options = { upsert: true};
            const updateDocument = {
                $set: purchase
            };
            const result = await partCollection.updateOne(
                filter,
                updateDocument,
                options
            );
            console.log("updating", id);
            res.send(result);
        });
    }
    finally{

    }
}

run().catch(console.dir);

app.get('/', (req, res) => {
  res.send('Hello From All In One')
})


app.listen(port, () => {
  console.log(`Car Parts listening on port ${port}`)
})
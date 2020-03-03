const dialogflow = require('dialogflow');
const uuid = require('uuid');
const express = require('express');
const bodyParser = require('body-parser');
const app = express();
const PORT = process.env.PORT;
const knex = require('knex');

userDetailsArray = [];
selectedPizzaItemArrays = [];
availablePizzaItemArrays = [];


const db = knex({
  client: 'pg',
  connection: {
    connectionString : process.env.DATABASE_URL,
    ssl: true,
    
  }
});


getAvailablePizzas();
const sessionId = uuid.v4(); // A unique identifier for the given

app.use(bodyParser.urlencoded({
  extended: false
}))
app.use(function (req, res, next) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS, PUT, PATCH, DELETE');
res.setHeader('Access-Control-Allow-Headers', 'X-Requested-With, content - type');
res.setHeader('Access-Control-Allow-Credentials', true);
  // Pass to next layer of middleware
  next();
});
app.post('/send-msg', (req, res) => {
  runSample(req.body.MSG, res).then(data => {
    if (data.includes("Enjoy your Pizza") || data.includes("Order Status for")){
console.log("Skippimh")
}else {
    res.send({ Reply: data })
  }
})
})
/**
* Send a query to the dialogflow agent, and return the query result.
* @param {string} projectId The project to be used
*/
async function runSample(msg, res, projectId = 'pizza-xxxggu') {
  // Create a new session
  const sessionClient = new dialogflow.SessionsClient({
    keyFilename: "Pizza-1d542537071a.json"
  });
  const sessionPath = sessionClient.sessionPath(projectId, sessionId);
  // The text query request.
  const request = {
    session: sessionPath,
    queryInput: {
      text: {
        // The query to send to the dialogflow agent
        text: msg,
        // The language used by the client (en-US)
        languageCode: 'en-US',
      },
    },
  };
  // Send request and log result
  const responses = await sessionClient.detectIntent(request);
  console.log('Detected intent');
  const result = responses[0].queryResult;
  const response = result.fulfillmentText;
  console.log(` Query: ${result.queryText}`);
  console.log(` Response: ${result.fulfillmentText}`);
  if (result.intent) {
    console.log(` Intent: ${result.intent.displayName}`);
  } else {
    console.log(` No intent matched.`);
  }
  if (response.includes("see a list of available Pizza")) {
    userDetailsArray['userName'] = result.queryText + "";
  }
  if (response.includes("to confirm the order to be deliv")) {
    userDetailsArray['Address'] = result.queryText + "";
  }
  console.log(response)
  if (response.includes("Order Status for Order ID")) {
    OrderId = result.queryText.split(" ")[result.queryText.split(" ").length-1];
console.log("OrderId is " + OrderId);
    getOrderDetails(OrderId, res);
  }
  for (availablePizzaItemArray of availablePizzaItemArrays) {
    if (result.queryText.includes(availablePizzaItemArray["PizzaVariantName"])){
selectedPizzaItemArray = availablePizzaItemArray;
    selectedPizzaItemArray["Quantiit"] = result.queryText.split(" ")
    [0];
    selectedPizzaItemArrays.push(availablePizzaItemArray);
  }
}
var queryLower =result.queryText.toLowerCase();
if(queryLower.includes("place order")){
  updateDetails(userDetailsArray, selectedPizzaItemArrays, res);
}
return result.fulfillmentText;
}
app.listen(PORT, () => {
  console.log("Running on port " +PORT)
})
function getOrderDetails(OrderId, res) {
  orderedData = [];
  response = "Order Details :: ";
  db.select('UserName', 'Address', 'Status').from('user_details')
    .where('OrderId', '=', OrderId)
    .then(data => {
      response = response + "Name : " + data[0]['UserName'] + ",";
      response = response + data[0]['Address'] + ",";
      response = response + " Status : " + data[0]['Status'] + ",";
      response = response + " Order Id : " + OrderId + ",";
      flag = true;
      db.select('*').from('item_details')
        .where('OrderId', '=', OrderId)
        .then(itemOrderedDetails => {
          price = 0;
          // console.log("1- " + response);
          for (i = 0; i < itemOrderedDetails.length; i++) {
            itemOrderedDetail = itemOrderedDetails[i];
            response = response + " Quantity : " +
              itemOrderedDetail['Quantiit'] + ",";
            quanity = itemOrderedDetail['Quantiit'];
            // console.log("2- " + response);
            db.select("*").from('pizza_variant_details').where('Id', '=',
              itemOrderedDetail['Item']).then(
                entries => {
                  pizzadetails = "";
                  pizzadetails = pizzadetails + " Item : " +
                    entries[0]['PizzaVariantName'];
                  pizzadetails = pizzadetails + ", Price : " +
                    entries[0]['Price'];
                  price = price + entries[0]['Price'] * quanity;
                  response = response + pizzadetails;
                  if (itemOrderedDetails.length == i) {
                    // console.log("3-" + response);
                    response = response + ", Total : " + price
                      + ". Enjoy your Order";
                    res.send({ Reply: response })
                    console.log("Order Details " + response)
                  }
                })
          }
        }).catch(err => console.log(err))
    })
}
function getAvailablePizzas() {
  db.from('pizza_variant_details').select('*')
    .then(entries => {
      populateAvailblePizzasArary(entries);
    }).catch(err => console.log(err))
}
function populateAvailblePizzasArary(entries) {
  for (entrie of entries) {
    availablePizzaItemArray = [];
    availablePizzaItemArray['Id'] = entrie['Id']
    availablePizzaItemArray["Price"] = entrie["Price"]
    availablePizzaItemArray["PizzaVariantName"] =
      entrie["PizzaVariantName"]
    availablePizzaItemArrays.push(availablePizzaItemArray);
  }
}
function updateDetails(userDetailsArray, selectedPizzaItemArrays,
  res) {
  db.transaction(trx => {
    trx.insert({
      "UserName": userDetailsArray["userName"],
      "Address": userDetailsArray["Address"],
      "Status": "ORDER_PLACED",
      "CreatedTime": new Date()
    })
      .into('user_details')
      .returning('OrderId').then(function (OrderId) {
        insertOrderedItems(selectedPizzaItemArrays[0], OrderId[0],
          res)
      })
      .then(trx.commit)
      .catch(trx.rollback)
  })
    .catch(err => console.log(err))
}
function insertOrderedItems(selectedPizzaItem, OrderId, res) {
  db.transaction(trx => {
    trx.insert({
      "Item": selectedPizzaItem['Id'],
      "Quantiit": selectedPizzaItem["Quantiit"],
      "OrderId": OrderId
    })
      .into('item_details')
      .returning('OrderId')
      .then(trx.commit).then(getOrderDetails(OrderId, res))
      .catch(trx.rollback)
  })
    .catch(err => console.log(err))
}
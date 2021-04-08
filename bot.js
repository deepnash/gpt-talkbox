
// This is your new function. To start, set the name and path on the left.
const axios = require('axios');

const syncSID = "ISca82ad5c45decc47c9b418614a9eeab3";
const myMapName = "mymap";

exports.handler = async (context, event, callback) => {
  
  const response = {};
  const client = context.getTwilioClient();
  let main_map = await createOrFetchMap(client);
  //let main_map = await client.sync.services(syncSID).syncMaps.create(({uniqueName: myMapName}));
  const phoneNumber = event.phoneNumber || "default102";
  console.warn("phone number: " + phoneNumber);
  
  // create a syncmap.
  var json_output = await client.sync.services(syncSID).syncMaps.create({uniqueName: "default5"})
                          .catch(error => console.warn("error creating = " + error))
                          .then( x => console.warn("create = " + JSON.stringify(x)));
  
  // add some data
  json_output = await client.sync.services(syncSID).syncMaps("default5").syncMapItems.create({key: 'foo2', data: {
              name: 'Foo Bar',
              level: 30,
              username: 'foo_bar'
            }}).then(x => console.warn("create syncmapitems = " + JSON.stringify(x)))
               .catch(x => console.warn(" create items = " + x));
            
  //console.warn(" create syncmapitems = " + JSON.stringify(json_output));
  
  // fetch
  json_output =  await client.sync.services(syncSID).syncMaps("default5").syncMapItems('foo')
           .fetch()
           .then(sync_map_item => console.warn("fetch = " + JSON.stringify(sync_map_item)))
           .catch(x => console.warn(" fetch error = " + x));
  
  
  // update
  json_output =  await client.sync.services(syncSID).syncMaps("default5").syncMapItems('foo').update({data: {
              name: 'FooBaz',
              level: 31,
              username: 'foo_baz'
            }})
           .then(sync_map_item => console.warn("update = " + JSON.stringify(sync_map_item)))
           .catch(x => console.warn("update error = " + x));
           
  // fetch again.
  json_output =  await client.sync.services(syncSID).syncMaps("default5").syncMapItems('foo2')
           .fetch()
           .then(sync_map_item => console.warn("fetch = " + JSON.stringify(sync_map_item)))
           .catch(x => console.warn("fetch error = " + x));
           
  //let main_list = await createOrFetchList(client, phoneNumber);
  history = await fetchHistory(client, phoneNumber);
  console.warn("history = " + JSON.stringify(history) + " type of" + typeof history);
  //history = await fetchHistoryList(main_list);
  response.actions = await fallbackHandler(event, client, history, phoneNumber);
  
  callback(null, response);
};

async function createOrFetchMap(client) {
  let main_map = await client.sync.services(syncSID)
           .syncMaps(myMapName)
           .fetch();
  if (main_map === undefined) {
    main_map = await client.sync.services(syncSID).syncMaps.create(({uniqueName: myMapName}));
  }
  return main_map;
}

async function fetchHistory(client, phoneNumber) {
  let dialog = [
    'bot: Hello, how are you today?',
  ];
  
  console.warn(`Fetching history for phone number: ${phoneNumber}`);
  
  let item = await client.sync.services(syncSID)
           .syncMaps(myMapName).syncMapItems(phoneNumber)
           .fetch()
  .then(function(x) {
    console.warn('Map Item get() successful, item value:', JSON.stringify(x));
    dialog = JSON.parse(x.data.history);
  })
  .catch(function(error) {
    console.warn('Map Item get() failed', error);
  });

  if (item === undefined ) {
      console.warn("Creating new syncmap items entry for " + phoneNumber);
      await client.sync.services(syncSID)
           .syncMaps(myMapName)
           .syncMapItems
           .create({key: phoneNumber, data: {history: JSON.stringify(dialog)}})
           .then(sync_map_item => console.warn(" Creating new entry: " + JSON.stringify(sync_map_item)))
           .catch(x => console.warn(" error creating : " + JSON.stringify(x)));
  }
  return dialog; 
}

async function storeHistory(client, phoneNumber, history) {
  console.warn(`Storing history for phone number: ${phoneNumber}`);
  let json_history = JSON.stringify(history);
  console.warn(`history = ${json_history}`);
  await client.sync.services(syncSID)
           .syncMaps(myMapName)
           .syncMapItems(phoneNumber)
           .update({data: {history: json_history}})
           .then(sync_map_item => console.warn("Updating entry = " + JSON.stringify(sync_map_item)))
           .catch(x => console.warn(" store history failed = " + JSON.stringify(x)));
  //main_map.set(phoneNumber, history);
}

const fallbackHandler = async (event, client, history, phoneNumber) => {
  const actions = [];
  
  const instance = axios.create({
    baseURL: 'https://api.openai.com/v1/',
    headers: { Authorization: `Bearer ${process.env.OPENAI_API_KEY}` },
    
  });
  
  //const dialog = [
  //  'bot: Hello, how are you today?',
  //];
  var dialog = history;
  dialog.push(`human: ${event.CurrentInput}`);
  dialog.push(`bot:`);
  
  const completionParmas = {
    prompt: dialog.join('\n'),
    max_tokens: 75,
    temperature: 0.75,
    n: 1,
    stream: false,
    logprobs: null,
    echo: false,
    stop: '\n',
  };
  
  try{
    //const result = await instance.post('/engines/davinci/completions', completionParmas);
    //const botResponse = result.data.choices[0].text.trim();
    const botResponse = " Here is my dummy response";
    dialog.pop();
    dialog.push(`bot: ${botResponse}`);
    await storeHistory(client, phoneNumber, dialog);
    actions.push({ say: botResponse});
  } catch (err) {
    console.warn(err);
    console.error(err);
    actions.push({ say: 'Sorry. Something went wrong. Arunesh will fix it.'});
  }
  actions.push({ listen:true});
  return actions;
}

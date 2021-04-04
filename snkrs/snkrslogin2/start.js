
const snkrsnew = require('./snkrsnew.js');

const obj = new snkrsnew()
obj.start().then(res=>{
    console.log(res)
})
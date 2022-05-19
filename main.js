const axios = require('axios');
var convert = require('xml-js');
 
axios.get('https://mikanani.me/RSS/MyBangumi?token=g7fiCQpq5lEeUkZ3gSn27LgehEcZ3larcTuNwFb5LUw%3d')
.then(res => {
    var result = convert.xml2json(res.data, {compact: true, spaces: 4});
    let rss = JSON.parse(result)
    let bangumi = rss.rss.channel.item;
    bangumi.forEach(anim => {
        console.log(anim.guid._text)
    });
    // console.log(rss.rss.channel.item);
})
.catch(err => {
    console.log('Error: ', err.message);
});

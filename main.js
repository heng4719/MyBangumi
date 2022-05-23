const axios = require('axios');
var convert = require('xml-js');
var mysql = require('mysql');

var connection = mysql.createConnection({
  host     : 'localhost',
  user     : 'root',
  password : '123456',
  database : 'bangumi'
});
 
connection.connect();
 
connection.query('SELECT * from user', function (error, results, fields) {
  if (error) throw error;
  console.log('The results is: ', results);
});
 
axios.get('https://mikanani.me/RSS/MyBangumi?token=g7fiCQpq5lEeUkZ3gSn27LgehEcZ3larcTuNwFb5LUw%3d')
.then(res => {
    var result = convert.xml2json(res.data, {compact: true, spaces: 4});
    let rss = JSON.parse(result)
    // console.log("result ", result)
    let bangumi = rss.rss.channel.item;
    let subscribes = [
        {
            title: ['古见同学有交流障碍症'],
            source:[
                // {
                //     title:"【幻樱字幕组】【4月新番】【古见同学有交流障碍症 Komi-san wa, Komyushou Desu.】【19】【BIG5_MP4】【1920X1080】",
                //     episode:19,
                //     link:"https://mikanani.me/Home/Episode/20e2db4e41a3a4c5f110428a8c06cfd433d676f9",
                //     torrent:"https://mikanani.me/Download/20220519/20e2db4e41a3a4c5f110428a8c06cfd433d676f9.torrent",
                // }
            ]
        },
        {
            title: ['街角魔族', '街角的魔族女孩'],
            source:[]
        },
        {
            title: ['夏日重现', '夏日时光'],
            source:[]
        },
    ]
    
    //在订阅列表中匹配番剧名称
    subscribes.forEach((sub, index) => {
        //可能存在多个名称，所以每个名称都匹配一遍
        sub.title.forEach(name => {
            bangumi.forEach(anim => {
                if(anim.guid._text.lastIndexOf(name) >= 0){
                    //查询出这是第几集
                    let episodeIndex = String(anim.guid._text).search(/\[[0-9][0-9]\]/) == -1 ? //[05]
                            (String(anim.guid._text).search(/\【[0-9][0-9]\】/) == -1 ? //【05】
                                (String(anim.guid._text).search(/\s[0-9][0-9]\s/) == -1 ? //  05  
                                -1:String(anim.guid._text).search(/\s[0-9][0-9]\s/))
                            :String(anim.guid._text).search(/\【[0-9][0-9]\】/) )
                        :String(anim.guid._text).search(/\[[0-9][0-9]\]/)
                    if(episodeIndex != -1){
                        let episode = parseInt(anim.guid._text.slice(episodeIndex+1, episodeIndex+3))
                        subscribes[index].source.push({
                            title: anim.guid._text,
                            episode: episode,
                            link: anim.link._text,
                            torrent: anim.enclosure._attributes.url
                        })
                        
                    }
                }
            });
        })
    })
    subscribes.forEach(sub => {
        sub.source.sort(function(a, b) {
            return b.episode - a.episode
        })
    });
    console.log("subscribes: ", JSON.stringify(subscribes))

})
.catch(err => {
    console.log('Error: ', err.message);
});

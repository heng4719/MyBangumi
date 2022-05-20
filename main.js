const axios = require('axios');
var convert = require('xml-js');
 
axios.get('https://mikanani.me/RSS/MyBangumi?token=g7fiCQpq5lEeUkZ3gSn27LgehEcZ3larcTuNwFb5LUw%3d')
.then(res => {
    var result = convert.xml2json(res.data, {compact: true, spaces: 4});
    let rss = JSON.parse(result)
    let bangumi = rss.rss.channel.item;
    let subscribe = [
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
            title: ['街角魔族', '街角的魔族女孩'],
            source:[]
        },
        {
            title: ['夏日重现', '夏日时光'],
            source:[]
        },
    ]
    bangumi.forEach(anim => {
        console.log(anim.guid._text)
    });
})
.catch(err => {
    console.log('Error: ', err.message);
});

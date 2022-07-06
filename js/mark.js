function insert(connection, id, msg, img){    
    return new Promise(function(resove, reject){
        let name =  msg.replaceAll("#mark ", "").replaceAll("\n ", "").replaceAll("\r ", "")
        console.log("name", name)
        console.log("imgUrl", img)
        if(name.length == 0){
            resove("名称长度异常")
        }
        if(img.length == 0){
            console.log("图片暂缺")
        }
        
        let sql = "insert into ero_comic values(?,?,?,?)";
        let params=[null, name, img, id];
        connection.query(sql,params,(err,result)=>{
            if (err) {
                console.error("新增失败" + err.message);
                resove("马什么梅？")
            }
            resove("插眼")
        });
    })
}

module.exports = {
    insert
}
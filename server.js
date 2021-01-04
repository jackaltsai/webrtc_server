//import websocket
const websocket = require('ws');

const ws = new websocket.Server({ port : 7080}, () => {
    console.log('ws:// 0.0.0.0:' + 7080);
});//創建一個websocket對象 監聽端口7080

//save connect socket set
var clients = new Set();


//save session
var sessions = [];

//refresh join message
function updatePeers() {
    var peers = [];
    clients.forEach(function (client) {
        var peer = {};

        if (client.hasOwnProperty('id')) {
            peer.id = client.id;
        }

        if (client.hasOwnProperty('name')) {
            peer.name = client.name;
        }

        if (client.hasOwnProperty('session_id')) {
            peer.session_id = client.session_id;
        }
        peers.push(peer);
    });

    var msg = {
        type: "peers",
        data: peers
    };

    clients.forEach(function (client) {
        send(client, JSON.stringify(msg));
    });
}


//連接處理
ws.on('connection', function connection(client_self) {
    clients.add(client_self);
    
    //收到消息處理
    client_self.on('message', function (message) {
        try {
            message = JSON.parse(message);
            console.log('message.type::: ' + message.type + ", \n body: "+ JSON.stringify(message));

        } catch (e) {
            console.log(e.message);
        }

        switch (message.type) {
            // 新成員加入
            case 'new':
                {
                    client_self.id = "" + message.id;
                    client_self.name = message.name;
                    client_self.user_agent = message.user_agent;
                    //向客戶端發送有新用戶加入
                    updatePeers();
                }
                break;

            // 離開房間
            case 'bye':
                {
                    var session = null;
                    sessions.forEach((sess) => {
                        if (sess.id == message.session_id) {
                            session = sess;
                        }
                    });

                    if (!session) {
                        var msg = {type:"error",data: {
                            error: "Invalid session" + message.session_id,
                        }};
                        send(client_self,JSON.stringify(msg));
                        return;

                    }

                    clients.forEach((client) => {
                        if (client.session_id === message.session_id) {
                            var msg = {
                                type: "bye",
                                data: {
                                    session_id: message.session_id,
                                    from: message.from,
                                    to: (client.id === session.from ? session.to: session.from),
                                }
                            };
                            send(client, JSON.stringify(msg));
                        }
                    });
                    break;
                }
                
            // 轉發offer
            case 'offer':
                {
                    var peer = null;
                    clients.forEach(function (client) {
                        if (client.hasOwnProperty('id') && client.id === "" + message.to) {
                            peer = client;
                        }
                    });
                    if (peer != null) {
                        msg = {
                            type: "offer",
                            data: {
                                to: peer.id,
                                from: client_self.id,
                                session_id:message.session_id,
                                description:message.description
                            }
                        }
                        send(peer, JSON.stringify(msg));

                        peer.session_id = message.session_id;
                        client_self.session_id = message.session_id;

                        let session = {
                            id: message.session_id,
                            from: client_self.id,
                            to:peer.id
                        };
                        sessions.push(session);
                    }

                }
                break;

            // 轉發answer
            case 'answer':
                {
                    var msg = {
                        type: "answer",
                        data:{
                            to: message.to,
                            from:client_self.id,
                            description:message.description
                        }
                    };

                    clients.forEach(function (client) {
                        if (client.id === "" + message.id &&
                        client.session_id === message.session_id ) {
                            send(client, JSON.stringify(msg));
                        }
                    });
                }
                break;
            // 收到candidate轉發
            case 'candidate':
                {
                    var msg = {
                        type: "candidate",
                        data:{
                            from: client_self.id,
                            to: message.to,
                            candidate: message.candidate
                        }
                    };

                    clients.forEach(function (client) {
                        if (client.id === "" + message.to &&
                        client.session_id === message.session_id) {
                            send(client,JSON.stringify(msg));
                        }
                    });
                }
                break;
            // keepalive 心跳 保持連接
            case "keeplive":
                {
                    send(client_self,JSON.stringify({type: 'keeplive',data: {}}));
                }
                break;
        }
    });
});

// send message
function send(client, message) {
    try {
        client.send(message);
    } catch (e) {
        console.log("Send failure !:" + e);
    }
    
    
}
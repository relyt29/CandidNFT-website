export default function handler(req, res) {
    function str2ab(str) {
      const buf = new ArrayBuffer(str.length);
      const bufView = new Uint8Array(buf);
      for (let i = 0, strLen = str.length; i < strLen; i++) {
        bufView[i] = str.charCodeAt(i);
      }
      return buf;
    }
    function byteToHexString(byteArray) {
      let s = '';
      byteArray.forEach(function(byte) {
        s += ('0' + (byte & 0xFF).toString(16)).slice(-2);
      });
      return s;
    }

    let postDataArr = [];
    if (req.method === 'POST') {
      // Process a POST request
      req.on('data', function (chunk) {
        postDataArr.push(chunk);
      });
      req.on('end', function () {
        if (!req.headers['content-type'] || req.headers['content-type'].indexOf('multipart') !== 0) {
          const buf = Buffer.concat(postDataArr);

          const addr = 'ws://20.106.154.181:9001'
          let ws = new WebSocket(addr);

          ws.addEventListener('open', evt => {
            console.log("connection opened");
            ws.send(buf);
          });

          ws.addEventListener('message', evt => {
            console.log( "Received Message: " + evt.data);
            const decoded = new Uint8Array(str2ab(atob(evt.data)))
            let resp = decoded[0].toString() + ", ";
            resp = resp + "0x" + byteToHexString(decoded.slice(1, 33)) + ", ";
            resp = resp + "0x" + byteToHexString(decoded.slice(33, 65));

            console.log(resp);
            ws.close();
            res.status(200).json({ r: resp });
          });

          ws.addEventListener('close', evt => {
            console.log("Connection closed.");
            res.status(200).json({ r: "conn closed" });
          });

          ws.addEventListener('error', function (event) {
            console.log('WebSocket error: ', event);
            const rr = `WebSocket error: ${event}`;
            res.status(200).json({ err: rr })
          });

        } else {
          console.log("I have no idea what i am doing");
        }
      });
  } else {
    res.status(200).json({ text: 'Needs post bro' });
  }
}

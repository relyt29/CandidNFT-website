import { useWeb3React } from "@web3-react/core";
import { ethers } from "ethers";
//import { computePublicKey, recoverPublicKey } from "@ethersproject/signing-key";
//import { getAddress } from "@ethersproject/address";
//import { hexDataSlice } from "@ethersproject/bytes";
import Head from "next/head";
import Link from "next/link";
import Image from 'next/image';
import Account from "../components/Account";
import ETHBalance from "../components/ETHBalance";
import useEagerConnect from "../hooks/useEagerConnect";

function Home() {
  const { account, library } = useWeb3React();

  const triedToEagerConnect = useEagerConnect();

  const isConnected = typeof account === "string" && !!library;

	function ab2str(buf) {
		return String.fromCharCode.apply(null, new Uint8Array(buf));
	}

	function str2ab(str) {
		const buf = new ArrayBuffer(str.length);
		const bufView = new Uint8Array(buf);
		for (let i = 0, strLen = str.length; i < strLen; i++) {
			bufView[i] = str.charCodeAt(i);
		}
		return buf;
	}

	function hexStringToByte(str) {
		if (!str) {
			return new Uint8Array();
		}

		let a = [];
		for (let i = 0, len = str.length; i < len; i+=2) {
			a.push(parseInt(str.substr(i,2),16));
		}

		return new Uint8Array(a);
	}


	function byteToHexString(byteArray) {
		let s = '';
		byteArray.forEach(function(byte) {
			s += ('0' + (byte & 0xFF).toString(16)).slice(-2);
		});
		return s;
	}

	async function exportCryptoKey(format, key) {
		const exported = await crypto.subtle.exportKey(
			format,
			key
		);
		const exportedAsString = ab2str(exported);
		return btoa(exportedAsString);
	}

	async function aesEnc(key, msg) {
		// Import SGX public key
		let sgx = await crypto.subtle.importKey(
			"raw",
			str2ab(atob(key)),
			{
				name: "ECDH",
				namedCurve: "P-256"
			},
			true,
			[]
		);

		// Generate key pair
		let keyPair = await crypto.subtle.generateKey(
			{
				name: "ECDH",
				namedCurve: "P-256"
			},
			true,
			["deriveKey"]
		);
		// var pubKey = await exportCryptoKey("raw", keyPair.publicKey);
		// var secKey = await exportCryptoKey("pkcs8", keyPair.privateKey);
		const pubKey = await crypto.subtle.exportKey("raw", keyPair.publicKey);
		const pubKeyA8 = new Uint8Array(pubKey);

		// Derive AES key by ECDH
		let symKey = await crypto.subtle.deriveKey(
			{
				name: "ECDH",
				public: sgx
			},
			keyPair.privateKey,
			{
				name: "AES-GCM",
				length: 256
			},
			true,
			["encrypt", "decrypt"]
		);

		// Encrypt message by AEC-GCM-256
		const iv = crypto.getRandomValues(new Uint8Array(32));
		const encrypted = await crypto.subtle.encrypt(
			{
				name: "AES-GCM",
				iv: iv
			},
			symKey,
			msg
		);
		const encryptedA8 = new Uint8Array(encrypted);

		// Construct message: pubKey || iv || tag || cipher
		const cipher = new Uint8Array(pubKeyA8.length + iv.length + encryptedA8.length);
		cipher.set(pubKeyA8);
		cipher.set(iv, pubKeyA8.length);
		cipher.set(encryptedA8.slice(-16), pubKeyA8.length + iv.length);
		cipher.set(encryptedA8.slice(0, encryptedA8.length - 16), pubKeyA8.length + iv.length + 16);
		const cipherA = btoa(ab2str(cipher));
		//console.log(cipher);
		return cipherA;
	} /* end aesEnc() */


	function encryptAndSend(msg) {
		let ws = new WebSocket(addr);

		ws.addEventListener('open', evt => {
      console.log("connection opened");
			const encrypted = aesEnc(sgx_pk, msg).then(encrypted => {
				console.log(`Sending ${encrypted}`);
				ws.send(encrypted);
			});
		});

		ws.addEventListener('message', evt => {
			console.log( "Received Message: " + evt.data);
			let resp = evt.data;
			//const decoded = new Uint8Array(str2ab(atob(evt.data)))
			//let resp = decoded[0].toString() + ", ";
			//resp = resp + "0x" + byteToHexString(decoded.slice(1, 33)) + ", ";
			//resp = resp + "0x" + byteToHexString(decoded.slice(33, 65));

      console.log(resp);
			ws.close();
		});

		ws.addEventListener('close', evt => {
			console.log("Connection closed.");
		});

    ws.addEventListener('error', function (event) {
      console.log('WebSocket error: ', event);
    });

	}

	function removePrefix(str) {
		if (str.substring(0, 2) === "0x") {
			return str.substring(2);
		} else {
			return str;
		}
	}

	const addr = 'ws://20.106.154.181:9001'

	const sgx_pk = 'BBarzLnfkPo3nLmRjT82ifMm8sbQpQSqavgD9omSAkorhxG+/8C7OqVKduXw2SZmBKYQYTNyqt6DwU4XSy6hkTw='

  const getWalletInfo = async function() {
    const signr = library.getSigner();
    const walletAddr = await signr.getAddress();
    const userAddr = walletAddr.toLowerCase();
    const message = `candidNFT:${userAddr}`;
    const signedMessage = await signr.signMessage(message);
    const formattedMessage = ethers.utils.hashMessage(message);
    const publicKey = ethers.utils.recoverPublicKey(formattedMessage, signedMessage);
    //const checkAddr = getAddress(hexDataSlice(ethers.utils.keccak256(hexDataSlice(publicKey, 1)), 12));
    console.log(message);
    console.log(`signedMessage: ${signedMessage}`);
    console.log(`formatted message ${formattedMessage}`);
    console.log(`public key ${publicKey}`);
    //console.log(checkAddr);
    console.log(userAddr);
    //const concatArray = userAddr + "\x14" + publicKey + signedMessage;
    //console.log(`ConcatArray ${concatArray}`);
    const encodedMessage = new Uint8Array([...hexStringToByte(removePrefix(userAddr)), 14, ...hexStringToByte(removePrefix(publicKey)), ...hexStringToByte(removePrefix(signedMessage))]);
    console.log(`Encoded Message ${JSON.stringify(encodedMessage)}`);
    encryptAndSend(encodedMessage);
  }

  const notready = function () {
    console.log("Not implemented yet");
  }

  return (
    <div>
      <Head>
        <title>next-web3-boilerplate</title>
        <link rel="icon" href="/favicon.ico" />
      </Head>

      <header>
        <nav>
          <Link href="/" passHref>
            <Image src="/images/logo.png"
              width="400"
              height="52"
              alt=""
              className="h-full w-full"/>
          </Link>
          <Account triedToEagerConnect={triedToEagerConnect} />
        </nav>
      </header>

      <main>
        <div>
          <h1 className="text-8xl font-bold m-10">
            Enter the Raffle
          </h1>
          <div className="buttoncontainer">
            <div className="ssncontainer m-4">
              <button onClick={notready}
              className="bg-blue-500 hover:bg-blue-700 text-white font-bold text-4xl py-2 px-4 border border-blue-700 rounded m-4"
              >
              use SSN
              </button>
              <a
                href="/download/CandidNFT-ChromeExtension.zip"
                target="_blank"
                rel="noopener noreferrer"
              >Download Chrome Extension</a>
            <p>To use the SSN option to register for the raffle, you must download our chrome (sorry only chrome supported) extension, and prove the ability to log in to the US Social Security Administration website.</p>
            </div>
            <div className="poapcontainer m-4">
              <button onClick={getWalletInfo}
              className="bg-blue-500 hover:bg-blue-700 text-white font-bold text-4xl py-2 px-4 border border-blue-700 rounded m-1"
              >
              use PoAP
              </button>
              <p>To use the PoAP option to register for the raffle, you must have a wallet holding one of the eligble PoAPs from our list, and connect with Metamask on the top right side of this web page.</p>
            </div>
          </div>
        </div>
        <div className="br divide-y-4 mb-20"><br/></div>
        <div className="justify-center"><h1 className="font-bold text-4xl">Team</h1></div>
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-6">
          <div className="flex flex-col items-center justify-center bg-white p-4 shadow rounded-lg m-10">
            <div className="inline-flex shadow-lg border border-gray-200 rounded-full overflow-hidden h-40 w-40">
              <Image src="/images/yanji.jpg"
                width="290"
                height="290"
                alt=""
                className="h-full w-full"/>
            </div>
            <h2 className="mt-4 font-bold text-xl">Yan Ji</h2>
            <h6 className="mt-2 text-sm font-medium">PhD Student</h6>
            <p className="text-xs text-gray-500 text-center mt-3">
              Yan Ji is a PhD student at Cornell University.
            </p>
          </div>
          <div className="flex flex-col items-center justify-center bg-white p-4 shadow rounded-lg m-10">
            <div className="inline-flex shadow-lg border border-gray-200 rounded-full overflow-hidden h-40 w-40">
              <Image src="/images/tyler.jpg"
                width="290"
                height="290"
                alt=""
                className="h-full w-full"/>
            </div>
            <h2 className="mt-4 font-bold text-xl">Tyler Kell</h2>
            <h6 className="mt-2 text-sm font-medium">Research Engineer</h6>
            <p className="text-xs text-gray-500 text-center mt-3">
             Tyler Kell is a research engineer at IC3. In a previous life, Tyler was a penetration tester, and enjoys an extensive history of breaking security assumptions.
            </p>
          </div>
          <div className="flex flex-col items-center justify-center bg-white p-4 shadow rounded-lg m-10">
            <div className="inline-flex shadow-lg border border-gray-200 rounded-full overflow-hidden h-40 w-40">
              <Image src="/images/deepak.jpg"
                width="290"
                height="290"
                alt=""
                className="h-full w-full"/>
            </div>
            <h2 className="mt-4 font-bold text-xl">Deepak Maram</h2>
            <h6 className="mt-2 text-sm font-medium">PhD Student</h6>
            <p className="text-xs text-gray-500 text-center mt-3">
            Deepak Maram is a fourth-year PhD student at Cornell Tech whose research interests lie in applied cryptography. Common themes include enriching blockchains with new functionality and building user-centric systems.
            </p>
          </div>
          <div className="flex flex-col items-center justify-center bg-white p-4 shadow rounded-lg m-10">
            <div className="inline-flex shadow-lg border border-gray-200 rounded-full overflow-hidden h-40 w-40">
              <Image src="/images/ari.png"
                width="290"
                height="290"
                alt=""
                className="h-full w-full"/>
            </div>
            <h2 className="mt-4 font-bold text-xl">Ari Juels</h2>
            <h6 className="mt-2 text-sm font-medium">Professor</h6>
            <p className="text-xs text-gray-500 text-center mt-3">
              Ari Juels is the Weill Family Foundation and Joan and Sanford I. Weill Professor in the Jacobs Technion-Cornell Institute at Cornell Tech and the Technion and a Computer Science faculty member at Cornell University. He is a Co-Director of the Initiative for CryptoCurrencies and Contracts (IC3). He is also Chief Scientist at Chainlink.
            </p>
          </div>

        </div>
        <div>
          <Link href="https://www.initc3.org/" passHref>
            <Image src="/images/ic3.png"
              width="350"
              height="60"
              alt=""
              className="h-full w-full"/>
          </Link>
        </div>
      </main>

      <style jsx>{`
        nav {
          display: flex;
          justify-content: space-between;
        }

        main {
          text-align: center;
        }
      `}</style>
    </div>
  );
}

export default Home;

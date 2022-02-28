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


	function encryptAndSendWs(msg) {
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

	function encryptAndSendHttps(msg) {
  	let encrypted = aesEnc(sgx_pk, msg).then(encrypted => {
    console.log(encrypted);
    fetch(https_url, {
      method: 'POST', // *GET, POST, PUT, DELETE, etc.
      body: JSON.stringify(encrypted) // body data type must match "Content-Type" header
    })
      .then(response => {
        response.text().then(text => {
          console.log(text);
    			logToScreen(`Request for Identity NFT sent!\nResponse message: ${JSON.stringify(text)}`);
        });
      })
      .catch(err => {
        console.log(err)
      });
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
	const https_url = 'https://sgx.candid.id'

	const sgx_pk = 'BBarzLnfkPo3nLmRjT82ifMm8sbQpQSqavgD9omSAkorhxG+/8C7OqVKduXw2SZmBKYQYTNyqt6DwU4XSy6hkTw='


function delay(time) {
  return new Promise(resolve => setTimeout(resolve, time));
}

  const logToScreen = function(msg: string) {
    const outArea: any = document.getElementById('logTextArea');
    let existing = outArea.value;
    if(existing.length > 0)
      existing += "\n";
    existing += msg;
    outArea.value = existing;
  }


  const getWalletInfo = async function() {
    let signr = undefined;
    try {
      signr = library.getSigner();
    } catch (error) {
      alert("Error during connecting to metamask, did you log in to metamask in the top right hand corner?");
      return;
    }
    const walletAddr = await signr.getAddress();
    const userAddr = walletAddr.toLowerCase();
    const message = `candidNFT:${userAddr}`;
    const signedMessage = await signr.signMessage(message);
    const formattedMessage = ethers.utils.hashMessage(message);
    const publicKey = ethers.utils.recoverPublicKey(formattedMessage, signedMessage);
    //const checkAddr = getAddress(hexDataSlice(ethers.utils.keccak256(hexDataSlice(publicKey, 1)), 12));
    logToScreen(message);
    logToScreen(`signedMessage: ${signedMessage}`);
    console.log(`formatted message ${formattedMessage}`);
    console.log(`public key ${publicKey}`);
    //logToScreen(checkAddr);
    console.log(userAddr);
    //const concatArray = userAddr + "\x14" + publicKey + signedMessage;
    //logToScreen(`ConcatArray ${concatArray}`);
    const encodedMessage = new Uint8Array([...hexStringToByte(removePrefix(userAddr)), 14, ...hexStringToByte(removePrefix(publicKey)), ...hexStringToByte(removePrefix(signedMessage))]);

    console.log(`Encoded Message ${JSON.stringify(encodedMessage)}`);
   	encryptAndSendHttps(encodedMessage);
  }

  const ssaRedirect = function () {
    logToScreen("Redirecting to SSA Website...");
    window.open("https://secure.ssa.gov/RIL/SiView.action", '_blank');
  }

  const coinbaseRedirect = function () {
    logToScreen("Redirecting to Coinbase Website...");
    window.open("https://coinbase.com", '_blank');
  }

  const listOfPoaps = function() {
    logToScreen("ETHBuenosAires 2019");
    logToScreen("ETHBuenosAires 2019 (alt)");
    logToScreen("ETHAtlanta 2018");
    logToScreen("EDCon 2018");
    logToScreen("EDCon 2019");
    logToScreen("ETHDenver 2018");
    logToScreen("ETHDenver 2019");
    logToScreen("ETHCC 2018");
    logToScreen("ETHCC 2019");
    logToScreen("Dappcon 2018");
    logToScreen("Dappcon 2019");
    logToScreen("Devcon 1");
    logToScreen("Devcon 2");
    logToScreen("Devcon 3");
    logToScreen("Devcon 4");
    logToScreen("Devcon 5");
    logToScreen("ZCon 2018");
    logToScreen("ETHSanFrancisco 2018");
    logToScreen("Nifty 2018 (HK)");
    logToScreen("ETHBerlin 2018");
    logToScreen("ETHBerlin 2019");
    logToScreen("ETHCapeTown 2019");
    logToScreen("ETHNewYork 2019");
    logToScreen("ETHBoston 2019");
    logToScreen("ETHParis 2019");
    logToScreen("ETHMemphis 2018");
    logToScreen("Grailers IC Minting Event");
    logToScreen("IC3 Blockchain Camp 2021");
    logToScreen("IC3 Blockchain Camp 2021");
    logToScreen("CandidNFT ETH Denver 2022 Hackathon Project Participant");
  }

  return (
    <div>
      <Head>
        <title>CandidNFT Drop Mechanics Demo</title>
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
            The Fair Drop Raffle Has Ended!
          </h1>
          <h3 className="text-4xl font-bold m-10">
            <a href="https://etherscan.io/address/0x060d235dd8c5fc25893f9aaebcf7bf877abc58e9" className="text-blue-500">0x060d...58e9</a> You win an NFT art piece by <a href="http://zach.li/" className="text-blue-500">Zach Lieberman</a>!
          </h3>
          <div className="bg-black mr-48 ml-48 p-2 rounded-md">
            <h3 className="text-2xl font-bold pb-1">
            Our Demo:
            </h3>
            <p>
              This raffle is a demo of using the technology developed by researchers from Cornell, <a className="text-blue-500" href="https://eprint.iacr.org/2020/934.pdf">CANDID</a> and <a className="text-blue-500" href="https://eprint.iacr.org/2016/168.pdf">Town Crier</a> in particular, to establish privacy-preserving unique identities on blockchain and prevent scalping bots in NFT drops.
            </p>
            <h3 className="text-2xl font-bold pb-1">
            The problem:
            </h3>
            <p>
              Today, profit-seekers are able to use bots to buy up large amounts of NFTs at drops and then resell them at higher prices—much as scalpers do in conventional markets, e.g., the <a className="text-blue-500" href="https://markets.businessinsider.com/news/currencies/time-magazine-nft-crypto-ethereum-scalper-bots-bitcoin-timepiece-fees-2021-09">Time Magazine's NFT launch</a>. This practice is disruptive to the NFT market, as it creates a sense of unfairness. Among other things, it has raised concerns with artists who wish their NFTs to go to collectors interested in their art, rather than bot creators.
            </p>
            <h3 className="text-2xl font-bold pb-1">
              Our solution:
            </h3>
            <p>
              We utilized the decentralized identity system called CanDID to help enforce a one-NFT-per-person drop policy by establishing privacy-preserving unique identities based on data from trustworthy websites such as the Social Security Administration (SSA). Many other user characteristics can be proven using CanDID, e.g., eligibility conditions such as adult-only-NFT (or) country-only-NFT.
            </p>
            <p className="pb-1">
              For this demo, we built a tool based on Town Crier to scrape name from the SSA or Coinbase website, or alternatively the ownership list of Proof of Attendance Protocol, and use the information to deduplicate identities inside Intel SGX, a trusted execution environment, to guarantee integrity and protect users' privacy.Check out our <a className="text-blue-500" href="https://youtu.be/Y-M6G5656PU">video demo</a>.
            </p>
            <p>
              We won bounties from the generous Chainlink and Pocket Network sponsors at ETH Denver 2022!
            </p>
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
            Deepak Maram is a final-year PhD student at Cornell Tech whose research interests lie in applied cryptography. Common themes include enriching blockchains with new functionality and building user-centric systems.
            </p>
          </div>
          <div className="flex flex-col items-center justify-center bg-white p-4 shadow rounded-lg m-10">
            <div className="inline-flex shadow-lg border border-gray-200 rounded-full overflow-hidden h-40 w-40">
              <Image src="/images/kushal.png"
                width="290"
                height="290"
                alt=""
                className="h-full w-full"/>
            </div>
            <h2 className="mt-4 font-bold text-xl">Kushal Babel</h2>
            <h6 className="mt-2 text-sm font-medium">PhD Student</h6>
            <p className="text-xs text-gray-500 text-center mt-3">
            Kushal is a third year PhD student at Cornell University.
            </p>
          </div>
        </div>
        <div className="justify-center"><h1 className="font-bold text-4xl">Advised By</h1></div>
        <div className="grid grid-cols-1 items-center sm:grid-cols-2 md:grid-cols-3 xl:grid-cols-5 gap-6">
        <div></div>
        <div></div>
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

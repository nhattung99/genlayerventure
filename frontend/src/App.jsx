import React, { useState, useEffect } from 'react';
import { 
  LayoutDashboard, 
  PlusCircle, 
  Coins, 
  Settings, 
  TrendingUp, 
  Shield, 
  Cpu, 
  ExternalLink, 
  Search, 
  HelpCircle, 
  Loader2, 
  Terminal,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  Globe,
  Code,
  Share2,
  FileText,
  DollarSign,
  Vote,
  User,
  ArrowRight,
  RefreshCw,
  Wallet
} from 'lucide-react';
import { createClient, createAccount } from 'genlayer-js';
import { testnetBradbury } from 'genlayer-js/chains';

// Pre-populated realistic fallback proposals in case node RPC has connection issues
const FALLBACK_PROPOSALS = [
  {
    id: 0,
    proposer: "0x70997970C51812dc3A010C7d01b50e0d17dc79C8",
    project_name: "Aegis Privacy Protocol",
    website_url: "https://aegisprivacy.io",
    github_url: "https://github.com/aegis-protocol/core",
    whitepaper_url: "https://aegisprivacy.io/whitepaper.pdf",
    twitter_url: "https://x.com/aegisprivacy",
    funding_requested: 75000,
    status: 1, // 1 = VotingActive
    ai_memo: JSON.stringify({
      recommendation: "INVEST",
      confidence: 88,
      technical_score: 92,
      market_score: 84,
      scam_probability: 4,
      summary: "Aegis Protocol presents a solid implementation of zero-knowledge circuits addressing a critical need for privacy-preserving compliance.",
      strengths: ["Highly skilled cryptographic team", "Clear target market addressing regulatory compliance", "Active github repository with zero copy-paste boilerplate"],
      weaknesses: ["High dependency on gas optimization for zk-SNARK verifiers", "Intense competition in the ZK space"],
      risks: ["Regulatory pushback on privacy pools", "Complexity of audit vectors"]
    }),
    pitch_description: "A fully decentralized zero-knowledge compliance and privacy layer for cross-chain liquidity. Aegis allows users to verify regulatory compliance without revealing key transaction details."
  }
];

const DEFAULT_CONTRACT = import.meta.env.VITE_CONTRACT_ADDRESS || '0xEcC25ffe11aFE174A45Dd9c0938C7e2a031b5642';
const DEFAULT_RPC = import.meta.env.VITE_RPC_URL || 'https://rpc-bradbury.genlayer.com';

function App() {
  const [activeTab, setActiveTab] = useState('proposals');
  const [proposals, setProposals] = useState(FALLBACK_PROPOSALS);
  
  // Staking and Treasury state
  const [stakedBalance, setStakedBalance] = useState(15000); 
  const [treasuryBalance, setTreasuryBalance] = useState(450000); 
  const [userVoteWeight, setUserVoteWeight] = useState(15000); 
  const [totalStaked, setTotalStaked] = useState(150000);
  
  // Staking/deposit inputs
  const [stakeInput, setStakeInput] = useState('');
  const [unstakeInput, setUnstakeInput] = useState('');
  const [depositInput, setDepositInput] = useState('');
  
  // Proposal submit form
  const [formData, setFormData] = useState({
    projectName: '',
    websiteUrl: '',
    githubUrl: '',
    whitepaperUrl: '',
    twitterUrl: '',
    fundingRequested: '',
    pitchDescription: ''
  });

  const [selectedProposalId, setSelectedProposalId] = useState(null);

  // Voting counts tracking (proposalId -> {yes: weight, no: weight, voted: array})
  const [votes, setVotes] = useState({
    0: { yes: 78000, no: 12000, voted: ["0x70997970C51812dc3A010C7d01b50e0d17dc79C8"] }
  });

  // AI analysis terminal log simulation/fetching
  const [aiAnalyzingId, setAiAnalyzingId] = useState(null);
  const [aiLogs, setAiLogs] = useState([]);
  
  // Search and filter
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');

  // Connection settings
  const [connectionMode, setConnectionMode] = useState('live'); 
  const [rpcEndpoint, setRpcEndpoint] = useState(DEFAULT_RPC);
  const [contractAddress, setContractAddress] = useState(DEFAULT_CONTRACT);
  
  const [isLoading, setIsLoading] = useState(false);
  const [isNodeConnected, setIsNodeConnected] = useState(false);
  const [userAccount, setUserAccount] = useState(null);
  const [txHash, setTxHash] = useState(null);

  // Initialize Account from localstorage or create a new one
  useEffect(() => {
    let storedKey = localStorage.getItem('genlayer_private_key');
    if (!storedKey) {
      // Generate standard 32 bytes random private key for demo account signing
      storedKey = "0x" + Array.from({length: 64}, () => Math.floor(Math.random()*16).toString(16)).join('');
      localStorage.setItem('genlayer_private_key', storedKey);
    }
    try {
      const account = createAccount(storedKey);
      setUserAccount(account);
    } catch (e) {
      console.error("Failed to restore account, generating fresh key", e);
      const freshKey = "0x" + Array.from({length: 64}, () => Math.floor(Math.random()*16).toString(16)).join('');
      localStorage.setItem('genlayer_private_key', freshKey);
      setUserAccount(createAccount(freshKey));
    }
  }, []);

  // Fetch data on startup or when configuration changes
  useEffect(() => {
    if (connectionMode === 'live' && userAccount) {
      fetchBlockchainData();
    }
  }, [connectionMode, rpcEndpoint, contractAddress, userAccount]);

  const fetchBlockchainData = async () => {
    if (!userAccount) return;
    try {
      setIsLoading(true);
      
      const client = createClient({
        chain: {
          ...testnetBradbury,
          rpcUrls: {
            default: { http: [rpcEndpoint] }
          }
        }
      });

      // Get proposal count
      const countBigInt = await client.readContract({
        address: contractAddress,
        functionName: 'get_proposal_count',
        args: []
      });
      const count = Number(countBigInt);

      const fetchedProposals = [];
      const fetchedVotes = {};

      for (let i = 0; i < count; i++) {
        try {
          const jsonStr = await client.readContract({
            address: contractAddress,
            functionName: 'get_proposal_json',
            args: [BigInt(i)]
          });
          
          if (jsonStr) {
            const prop = JSON.parse(jsonStr);
            fetchedProposals.push(prop);

            // Fetch votes
            const votesStr = await client.readContract({
              address: contractAddress,
              functionName: 'get_proposal_votes',
              args: [BigInt(i)]
            });
            const voteData = JSON.parse(votesStr);
            fetchedVotes[i] = {
              yes: Number(voteData.yes),
              no: Number(voteData.no),
              voted: [] // local address tracking if needed
            };
          }
        } catch (e) {
          console.error(`Error reading proposal ID ${i}`, e);
        }
      }

      // Fetch global balances
      const treasuryVal = await client.readContract({
        address: contractAddress,
        functionName: 'get_treasury_balance',
        args: []
      });
      const totalStakedVal = await client.readContract({
        address: contractAddress,
        functionName: 'get_total_staked',
        args: []
      });
      const userStakedVal = await client.readContract({
        address: contractAddress,
        functionName: 'get_staked_balance',
        args: [userAccount.address]
      });

      // Only update state if data parsed successfully
      if (fetchedProposals.length > 0) {
        setProposals(fetchedProposals);
        setVotes(fetchedVotes);
      }
      setTreasuryBalance(Number(treasuryVal));
      setTotalStaked(Number(totalStakedVal));
      setStakedBalance(Number(userStakedVal));
      setUserVoteWeight(Number(userStakedVal));
      setIsNodeConnected(true);
      setIsLoading(false);
    } catch (err) {
      console.error("Failed to read from GenLayer node, keeping fallback mock representation:", err);
      setIsNodeConnected(false);
      setIsLoading(false);
    }
  };

  const handleFormChange = (e) => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value
    });
  };

  const handleSubmitProposal = async (e) => {
    e.preventDefault();
    if (!formData.projectName) return;

    if (connectionMode === 'live') {
      try {
        setIsLoading(true);
        const client = createClient({
          chain: {
            ...testnetBradbury,
            rpcUrls: { default: { http: [rpcEndpoint] } }
          },
          account: userAccount
        });

        const hash = await client.writeContract({
          address: contractAddress,
          functionName: 'submit_proposal',
          args: [
            formData.projectName,
            formData.websiteUrl,
            formData.githubUrl,
            formData.whitepaperUrl,
            formData.twitterUrl,
            BigInt(formData.fundingRequested),
            formData.pitchDescription
          ]
        });

        setTxHash({ type: 'submit', hash, project: formData.projectName });
        setTimeout(() => setTxHash(null), 8000);

        // Wait for transaction consensus finalization
        await client.waitForTransactionReceipt({ hash });
        await fetchBlockchainData();
        setActiveTab('proposals');
      } catch (err) {
        console.error("On-chain submission failed:", err);
        alert(`Transaction failed: ${err.message || err}`);
        setIsLoading(false);
      }
    } else {
      // Mock submit
      const newId = proposals.length;
      const newProposal = {
        id: newId,
        proposer: userAccount?.address || "0xUserMockAddress",
        project_name: formData.projectName,
        website_url: formData.websiteUrl,
        github_url: formData.githubUrl,
        whitepaper_url: formData.whitepaperUrl,
        twitter_url: formData.twitterUrl,
        funding_requested: Number(formData.fundingRequested) || 50000,
        pitch_description: formData.pitchDescription,
        status: 0,
        ai_memo: ""
      };
      setProposals([newProposal, ...proposals]);
      setActiveTab('proposals');
    }

    // Reset Form
    setFormData({
      projectName: '',
      websiteUrl: '',
      githubUrl: '',
      whitepaperUrl: '',
      twitterUrl: '',
      fundingRequested: '',
      pitchDescription: ''
    });
  };

  const handleTriggerAI = async (proposalId) => {
    if (connectionMode === 'live') {
      try {
        setAiLogs([
          "[INFO] Connecting to GenLayer Studio client...",
          "[INFO] Submitting evaluation request transaction to block validators..."
        ]);
        setAiAnalyzingId(proposalId);

        const client = createClient({
          chain: {
            ...testnetBradbury,
            rpcUrls: { default: { http: [rpcEndpoint] } }
          },
          account: userAccount
        });

        const hash = await client.writeContract({
          address: contractAddress,
          functionName: 'evaluate_proposal',
          args: [BigInt(proposalId)]
        });

        setAiLogs(prev => [
          ...prev,
          `[TX SENT] Hash: ${hash}`,
          "[INFO] Waiting for GenVM consensus nodes to render URL scraped contents and run LLM memo evaluation...",
          "[INFO] This requires execution of Leader block and Validator validations. Please hold..."
        ]);

        // Wait for final consensus output
        await client.waitForTransactionReceipt({ hash });
        
        setAiLogs(prev => [
          ...prev,
          "[SUCCESS] Consensus agreed across validators.",
          "[INFO] AI scores saved on-chain. Proposal updated to ACTIVE. Reloading state..."
        ]);

        setTimeout(async () => {
          await fetchBlockchainData();
          setAiAnalyzingId(null);
        }, 1500);

      } catch (err) {
        console.error("AI trigger failed:", err);
        setAiLogs(prev => [...prev, `[ERROR] Consensus run aborted: ${err.message || err}`]);
        setTimeout(() => setAiAnalyzingId(null), 5000);
      }
    } else {
      // Mock log pipeline
      setAiLogs([]);
      setAiAnalyzingId(proposalId);
      
      const mockPipeline = [
        "[INFO] Initializing GenVM Intelligent Agent...",
        "[SCRAPER] Accessing target website...",
        "[SCRAPER] Website content read: 2,410 bytes",
        "[LLM] Evaluating technical_score and scam_probability...",
        "[CONSENSUS] Validators re-executing leader proposed structure...",
        "[SUCCESS] Consensus reached: 3/3 validators agreed.",
        "[STATUS] AI Memo recorded on-chain. Proposal set to ACTIVE."
      ];

      for (let i = 0; i < mockPipeline.length; i++) {
        await new Promise(resolve => setTimeout(resolve, 800));
        setAiLogs(prev => [...prev, mockPipeline[i]]);
      }

      setProposals(prev => prev.map(p => {
        if (p.id === proposalId) {
          return {
            ...p,
            status: 1, // Active
            ai_memo: JSON.stringify({
              recommendation: "INVEST",
              confidence: 84,
              technical_score: 91,
              market_score: 78,
              scam_probability: 8,
              summary: "Codebase demonstrates modular architecture and original cryptographic primitives. The IoT model fits the market scope.",
              strengths: ["IoT telemetry smart contract integration", "Sound carbon math", "Vibrant community interest"],
              weaknesses: ["Oracle requires security validation", "Initial high gas cost expectations"],
              risks: ["Hardware dependency risk", "Carbon registry compliance variability"]
            })
          };
        }
        return p;
      }));

      setVotes(prev => ({
        ...prev,
        [proposalId]: { yes: 0, no: 0, voted: [] }
      }));
      setAiAnalyzingId(null);
    }
  };

  const handleVote = async (proposalId, support) => {
    if (connectionMode === 'live') {
      try {
        setIsLoading(true);
        const client = createClient({
          chain: {
            ...testnetBradbury,
            rpcUrls: { default: { http: [rpcEndpoint] } }
          },
          account: userAccount
        });

        const hash = await client.writeContract({
          address: contractAddress,
          functionName: 'vote_on_proposal',
          args: [BigInt(proposalId), support]
        });

        setTxHash({ type: 'vote', hash, choice: support ? 'YES' : 'NO', weight: userVoteWeight });
        setTimeout(() => setTxHash(null), 5000);

        await client.waitForTransactionReceipt({ hash });
        await fetchBlockchainData();
      } catch (err) {
        console.error("Voting failed:", err);
        alert(`Voting transaction failed: ${err.message || err}`);
        setIsLoading(false);
      }
    } else {
      const currentProposalVotes = votes[proposalId] || { yes: 0, no: 0, voted: [] };
      const voter = "0xUserAddressMock";
      
      if (currentProposalVotes.voted.includes(voter)) {
        alert("You have already voted on this proposal!");
        return;
      }

      setVotes(prev => ({
        ...prev,
        [proposalId]: {
          yes: support ? prev[proposalId].yes + userVoteWeight : prev[proposalId].yes,
          no: !support ? prev[proposalId].no + userVoteWeight : prev[proposalId].no,
          voted: [...prev[proposalId].voted, voter]
        }
      }));
    }
  };

  const handleFinalize = async (proposalId) => {
    const proposal = proposals.find(p => p.id === proposalId);
    const propVotes = votes[proposalId] || { yes: 0, no: 0 };
    const passed = propVotes.yes > propVotes.no;

    if (connectionMode === 'live') {
      try {
        setIsLoading(true);
        const client = createClient({
          chain: {
            ...testnetBradbury,
            rpcUrls: { default: { http: [rpcEndpoint] } }
          },
          account: userAccount
        });

        const hash = await client.writeContract({
          address: contractAddress,
          functionName: 'finalize_proposal',
          args: [BigInt(proposalId)]
        });

        setTxHash({ type: 'finalize', hash, result: passed ? 'PASSED & FUNDED' : 'DEFEATED' });
        setTimeout(() => setTxHash(null), 5000);

        await client.waitForTransactionReceipt({ hash });
        await fetchBlockchainData();
      } catch (err) {
        console.error("Finalization failed:", err);
        alert(`Finalization transaction failed: ${err.message || err}`);
        setIsLoading(false);
      }
    } else {
      if (passed && treasuryBalance < proposal.funding_requested) {
        alert("Insufficient treasury funds!");
        return;
      }

      setProposals(prev => prev.map(p => {
        if (p.id === proposalId) {
          return { ...p, status: passed ? 3 : 4 };
        }
        return p;
      }));

      if (passed) {
        setTreasuryBalance(prev => prev - proposal.funding_requested);
      }
    }
  };

  const handleStake = async (e) => {
    e.preventDefault();
    const val = Number(stakeInput);
    if (!val || val <= 0) return;

    if (connectionMode === 'live') {
      try {
        setIsLoading(true);
        const client = createClient({
          chain: {
            ...testnetBradbury,
            rpcUrls: { default: { http: [rpcEndpoint] } }
          },
          account: userAccount
        });

        const hash = await client.writeContract({
          address: contractAddress,
          functionName: 'stake_tokens',
          args: [],
          value: BigInt(val)
        });

        setTxHash({ type: 'stake', hash, amount: val });
        setTimeout(() => setTxHash(null), 5000);

        await client.waitForTransactionReceipt({ hash });
        await fetchBlockchainData();
        setStakeInput('');
      } catch (err) {
        console.error("Staking failed:", err);
        alert(`Staking failed: ${err.message || err}`);
        setIsLoading(false);
      }
    } else {
      setStakedBalance(prev => prev + val);
      setUserVoteWeight(prev => prev + val);
      setTotalStaked(prev => prev + val);
      setStakeInput('');
    }
  };

  const handleUnstake = async (e) => {
    e.preventDefault();
    const val = Number(unstakeInput);
    if (!val || val <= 0 || val > stakedBalance) return;

    if (connectionMode === 'live') {
      try {
        setIsLoading(true);
        const client = createClient({
          chain: {
            ...testnetBradbury,
            rpcUrls: { default: { http: [rpcEndpoint] } }
          },
          account: userAccount
        });

        const hash = await client.writeContract({
          address: contractAddress,
          functionName: 'unstake_tokens',
          args: [BigInt(val)]
        });

        setTxHash({ type: 'unstake', hash, amount: val });
        setTimeout(() => setTxHash(null), 5000);

        await client.waitForTransactionReceipt({ hash });
        await fetchBlockchainData();
        setUnstakeInput('');
      } catch (err) {
        console.error("Unstaking failed:", err);
        alert(`Unstaking failed: ${err.message || err}`);
        setIsLoading(false);
      }
    } else {
      setStakedBalance(prev => prev - val);
      setUserVoteWeight(prev => prev - val);
      setTotalStaked(prev => prev - val);
      setUnstakeInput('');
    }
  };

  const handleDepositTreasury = async (e) => {
    e.preventDefault();
    const val = Number(depositInput);
    if (!val || val <= 0) return;

    if (connectionMode === 'live') {
      try {
        setIsLoading(true);
        const client = createClient({
          chain: {
            ...testnetBradbury,
            rpcUrls: { default: { http: [rpcEndpoint] } }
          },
          account: userAccount
        });

        const hash = await client.writeContract({
          address: contractAddress,
          functionName: 'deposit_treasury',
          args: [],
          value: BigInt(val)
        });

        setTxHash({ type: 'deposit', hash, amount: val });
        setTimeout(() => setTxHash(null), 5000);

        await client.waitForTransactionReceipt({ hash });
        await fetchBlockchainData();
        setDepositInput('');
      } catch (err) {
        console.error("Treasury deposit failed:", err);
        alert(`Deposit failed: ${err.message || err}`);
        setIsLoading(false);
      }
    } else {
      setTreasuryBalance(prev => prev + val);
      setDepositInput('');
    }
  };

  // Filter and search logic
  const filteredProposals = proposals.filter(p => {
    const matchesSearch = p.project_name.toLowerCase().includes(searchQuery.toLowerCase()) || 
                          p.pitch_description.toLowerCase().includes(searchQuery.toLowerCase());
    
    if (statusFilter === 'all') return matchesSearch;
    if (statusFilter === 'submitted') return matchesSearch && Number(p.status) === 0;
    if (statusFilter === 'active') return matchesSearch && Number(p.status) === 1;
    if (statusFilter === 'rejected_ai') return matchesSearch && Number(p.status) === 2;
    if (statusFilter === 'funded') return matchesSearch && Number(p.status) === 3;
    if (statusFilter === 'defeated') return matchesSearch && Number(p.status) === 4;
    return matchesSearch;
  });

  const getStatusBadge = (statusNum) => {
    const status = Number(statusNum);
    switch (status) {
      case 0:
        return <span className="px-2.5 py-1 text-xs font-semibold rounded-full bg-blue-500/10 text-blue-400 border border-blue-500/30 flex items-center gap-1.5 w-fit"><Loader2 className="w-3.5 h-3.5 animate-spin"/> Submitted</span>;
      case 1:
        return <span className="px-2.5 py-1 text-xs font-semibold rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/30 flex items-center gap-1.5 w-fit"><Vote className="w-3.5 h-3.5"/> Voting Active</span>;
      case 2:
        return <span className="px-2.5 py-1 text-xs font-semibold rounded-full bg-rose-500/10 text-rose-400 border border-rose-500/30 flex items-center gap-1.5 w-fit"><XCircle className="w-3.5 h-3.5"/> Rejected By AI</span>;
      case 3:
        return <span className="px-2.5 py-1 text-xs font-semibold rounded-full bg-purple-500/10 text-purple-400 border border-purple-500/30 flex items-center gap-1.5 w-fit"><CheckCircle2 className="w-3.5 h-3.5"/> Funded</span>;
      case 4:
        return <span className="px-2.5 py-1 text-xs font-semibold rounded-full bg-amber-500/10 text-amber-400 border border-amber-500/30 flex items-center gap-1.5 w-fit"><AlertTriangle className="w-3.5 h-3.5"/> Defeated</span>;
      default:
        return null;
    }
  };

  const getScoreColor = (score) => {
    if (score >= 80) return 'text-emerald-400';
    if (score >= 50) return 'text-amber-400';
    return 'text-rose-400';
  };

  const getScamColor = (prob) => {
    if (prob < 20) return 'text-emerald-400';
    if (prob < 50) return 'text-amber-400';
    return 'text-rose-400 border-rose-500/20 bg-rose-950/20';
  };

  return (
    <div className="min-h-screen text-slate-100 flex flex-col relative bg-[#040508]">
      
      {/* Background Decorative Glows */}
      <div className="absolute top-[-10%] left-[-10%] w-[50%] h-[50%] rounded-full bg-cyan-500/5 blur-[120px] pointer-events-none" />
      <div className="absolute bottom-[-10%] right-[-10%] w-[50%] h-[50%] rounded-full bg-purple-500/5 blur-[120px] pointer-events-none" />

      {/* Transaction Alert banner */}
      {txHash && (
        <div className="fixed bottom-6 right-6 z-50 p-4 rounded-xl glass-panel border-cyan-500/40 shadow-2xl max-w-md animate-bounce">
          <div className="flex gap-3">
            <CheckCircle2 className="text-cyan-400 w-6 h-6 shrink-0 mt-0.5" />
            <div>
              <p className="font-semibold text-slate-200 text-sm">On-Chain Transaction Sent</p>
              {txHash.type === 'submit' && (
                <p className="text-xs text-slate-400 mt-1">Submitted startup <span className="text-cyan-400">{txHash.project}</span> to GenLayer.</p>
              )}
              {txHash.type === 'stake' && (
                <p className="text-xs text-slate-400 mt-1">Staking <span className="text-cyan-400">{txHash.amount.toLocaleString()} GEN</span> on-chain.</p>
              )}
              {txHash.type === 'unstake' && (
                <p className="text-xs text-slate-400 mt-1">Unstaking <span className="text-cyan-400">{txHash.amount.toLocaleString()} GEN</span> on-chain.</p>
              )}
              {txHash.type === 'deposit' && (
                <p className="text-xs text-slate-400 mt-1">Depositing <span className="text-cyan-400">{txHash.amount.toLocaleString()} GEN</span> to treasury.</p>
              )}
              {txHash.type === 'vote' && (
                <p className="text-xs text-slate-400 mt-1">Voting {txHash.choice} with weight {txHash.weight.toLocaleString()} GEN.</p>
              )}
              {txHash.type === 'finalize' && (
                <p className="text-xs text-slate-400 mt-1">Finalizing voting outcome: <span className="text-cyan-400">{txHash.result}</span>.</p>
              )}
              <div className="text-[10px] text-cyan-400 mt-2 font-mono flex items-center gap-1">
                <Loader2 className="w-3 h-3 animate-spin" /> Mining on GenLayer network...
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Header */}
      <header className="border-b border-slate-800/60 sticky top-0 bg-[#040508]/85 backdrop-blur-md z-40">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-20 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-cyan-400 to-purple-600 flex items-center justify-center shadow-lg shadow-cyan-500/20">
              <Cpu className="w-5.5 h-5.5 text-slate-900 font-bold" />
            </div>
            <div>
              <h1 className="text-xl font-bold tracking-tight text-white leading-none">AI Venture Capital DAO</h1>
              <p className="text-xs text-cyan-400/80 mt-1 font-mono">On-Chain VC Powered by AI Analysts</p>
            </div>
          </div>

          {/* Navigation Tabs */}
          <nav className="hidden md:flex items-center gap-1 bg-slate-900/60 p-1.5 rounded-xl border border-slate-800">
            <button 
              onClick={() => { setActiveTab('proposals'); setSelectedProposalId(null); }}
              className={`px-4 py-2 text-sm font-medium rounded-lg transition-all flex items-center gap-2 ${
                activeTab === 'proposals' 
                  ? 'bg-gradient-to-r from-slate-800 to-slate-800/60 text-cyan-400 border border-slate-700/80' 
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <LayoutDashboard className="w-4 h-4" /> Explore Proposals
            </button>
            <button 
              onClick={() => { setActiveTab('submit'); setSelectedProposalId(null); }}
              className={`px-4 py-2 text-sm font-medium rounded-lg transition-all flex items-center gap-2 ${
                activeTab === 'submit' 
                  ? 'bg-gradient-to-r from-slate-800 to-slate-800/60 text-cyan-400 border border-slate-700/80' 
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <PlusCircle className="w-4 h-4" /> Submit Startup
            </button>
            <button 
              onClick={() => { setActiveTab('staking'); setSelectedProposalId(null); }}
              className={`px-4 py-2 text-sm font-medium rounded-lg transition-all flex items-center gap-2 ${
                activeTab === 'staking' 
                  ? 'bg-gradient-to-r from-slate-800 to-slate-800/60 text-cyan-400 border border-slate-700/80' 
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <Coins className="w-4 h-4" /> Treasury & Staking
            </button>
            <button 
              onClick={() => { setActiveTab('settings'); setSelectedProposalId(null); }}
              className={`px-4 py-2 text-sm font-medium rounded-lg transition-all flex items-center gap-2 ${
                activeTab === 'settings' 
                  ? 'bg-gradient-to-r from-slate-800 to-slate-800/60 text-cyan-400 border border-slate-700/80' 
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <Settings className="w-4 h-4" /> Config RPC
            </button>
          </nav>

          {/* Connection status badge */}
          <div className="flex items-center gap-4">
            {userAccount && (
              <div className="hidden lg:flex items-center gap-2 px-3 py-1.5 rounded-lg bg-slate-900 border border-slate-800 text-[11px] font-mono text-slate-400">
                <Wallet className="w-3.5 h-3.5 text-cyan-400" />
                <span>{userAccount.address.substring(0, 8)}...{userAccount.address.substring(34)}</span>
              </div>
            )}
            <div className="flex items-center gap-3">
              <div className="hidden lg:flex flex-col text-right">
                <span className="text-[10px] text-slate-500 font-mono">CONNECTION</span>
                <span className={`text-xs font-mono font-medium ${isNodeConnected ? 'text-emerald-400' : 'text-cyan-400'}`}>
                  {connectionMode === 'live' && isNodeConnected ? 'Live Network' : connectionMode === 'live' ? 'Connecting...' : 'Simulator'}
                </span>
              </div>
              <div className={`w-2.5 h-2.5 rounded-full ${isNodeConnected ? 'bg-emerald-400 animate-pulse' : 'bg-cyan-400'} shadow-lg`} />
            </div>
          </div>
        </div>
      </header>

      {/* Main Container */}
      <main className="flex-1 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 w-full">

        {/* Global Banner for Fallback Connection Mode */}
        {connectionMode === 'live' && !isNodeConnected && (
          <div className="mb-6 p-4 rounded-xl bg-amber-950/20 border border-amber-800/30 flex items-center justify-between text-xs md:text-sm text-amber-300">
            <div className="flex items-center gap-3">
              <AlertTriangle className="w-5 h-5 text-amber-400 shrink-0" />
              <span>
                Could not connect to the contract at <code className="bg-amber-900/30 px-1.5 py-0.5 rounded font-mono text-white text-xs">{contractAddress}</code> via the RPC server. Showing local fallback mock proposals. Verify your endpoint in config.
              </span>
            </div>
            <button 
              onClick={fetchBlockchainData}
              className="px-3 py-1 bg-amber-500 text-slate-950 font-bold rounded-lg hover:bg-amber-400 transition-all flex items-center gap-1 shrink-0 ml-2"
            >
              <RefreshCw className="w-3.5 h-3.5" /> Reconnect
            </button>
          </div>
        )}

        {/* Loading Overlay */}
        {isLoading && (
          <div className="fixed inset-0 bg-[#000]/60 z-50 flex items-center justify-center p-4 backdrop-blur-xs">
            <div className="p-6 rounded-xl glass-panel text-center max-w-xs border-cyan-500/20">
              <Loader2 className="w-10 h-10 text-cyan-400 animate-spin mx-auto mb-4" />
              <p className="text-sm font-semibold text-slate-200">Executing On-Chain Transaction</p>
              <p className="text-xs text-slate-500 mt-1">Please confirm or sign in your GenLayer developer terminal...</p>
            </div>
          </div>
        )}

        {/* Mobile Navigation */}
        <div className="flex md:hidden bg-slate-900/80 border border-slate-800 rounded-xl p-1 mb-6 justify-between text-xs">
          <button 
            onClick={() => { setActiveTab('proposals'); setSelectedProposalId(null); }}
            className={`flex-1 py-2 text-center rounded-lg ${activeTab === 'proposals' ? 'bg-slate-800 text-cyan-400' : 'text-slate-400'}`}
          >
            Explore
          </button>
          <button 
            onClick={() => { setActiveTab('submit'); setSelectedProposalId(null); }}
            className={`flex-1 py-2 text-center rounded-lg ${activeTab === 'submit' ? 'bg-slate-800 text-cyan-400' : 'text-slate-400'}`}
          >
            Submit
          </button>
          <button 
            onClick={() => { setActiveTab('staking'); setSelectedProposalId(null); }}
            className={`flex-1 py-2 text-center rounded-lg ${activeTab === 'staking' ? 'bg-slate-800 text-cyan-400' : 'text-slate-400'}`}
          >
            Staking
          </button>
          <button 
            onClick={() => { setActiveTab('settings'); setSelectedProposalId(null); }}
            className={`flex-1 py-2 text-center rounded-lg ${activeTab === 'settings' ? 'bg-slate-800 text-cyan-400' : 'text-slate-400'}`}
          >
            RPC Config
          </button>
        </div>

        {/* ======================================================== */}
        {/* TAB: EXPLORE PROPOSALS */}
        {/* ======================================================== */}
        {activeTab === 'proposals' && selectedProposalId === null && (
          <div>
            {/* Search and Filters */}
            <div className="flex flex-col md:flex-row gap-4 justify-between items-center mb-8 bg-slate-900/30 p-4 rounded-xl border border-slate-800/80">
              <div className="relative w-full md:max-w-md">
                <Search className="absolute left-3.5 top-3.5 h-4 w-4 text-slate-500" />
                <input 
                  type="text"
                  placeholder="Search startups, summaries, description..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full bg-[#0a0c10] border border-slate-800 rounded-xl py-3 pl-10 pr-4 text-sm text-slate-300 focus:outline-none focus:border-cyan-500/60 focus:ring-1 focus:ring-cyan-500/20 transition-all placeholder:text-slate-600"
                />
              </div>

              <div className="flex gap-2 overflow-x-auto w-full md:w-auto text-xs font-semibold">
                {['all', 'submitted', 'active', 'funded', 'defeated'].map((filter) => (
                  <button
                    key={filter}
                    onClick={() => setStatusFilter(filter)}
                    className={`px-3.5 py-1.5 rounded-lg border capitalize shrink-0 transition-all ${
                      statusFilter === filter
                        ? 'bg-cyan-500/10 text-cyan-400 border-cyan-500/40'
                        : 'bg-slate-900/40 text-slate-400 border-slate-800 hover:text-slate-200'
                    }`}
                  >
                    {filter === 'rejected_ai' ? 'Rejected by AI' : filter}
                  </button>
                ))}
              </div>
            </div>

            {/* Proposal Cards Grid */}
            {filteredProposals.length === 0 ? (
              <div className="text-center py-20 bg-slate-900/10 rounded-2xl border border-dashed border-slate-800">
                <LayoutDashboard className="w-12 h-12 text-slate-700 mx-auto mb-4" />
                <p className="text-slate-400 text-lg">No proposals found matching the query.</p>
                <button 
                  onClick={() => setSearchQuery('')}
                  className="text-cyan-400 hover:underline mt-2 text-sm font-semibold"
                >
                  Clear search filters
                </button>
              </div>
            ) : (
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {filteredProposals.map((p) => {
                  const hasMemo = !!p.ai_memo;
                  const memo = hasMemo ? JSON.parse(p.ai_memo) : null;
                  const voteStats = votes[p.id] || { yes: 0, no: 0 };
                  const totalVotes = voteStats.yes + voteStats.no;
                  const yesPercent = totalVotes > 0 ? (voteStats.yes / totalVotes) * 100 : 0;

                  return (
                    <div 
                      key={p.id}
                      className="glass-panel rounded-2xl p-6 flex flex-col justify-between transition-all duration-300 relative group overflow-hidden border border-slate-800/80"
                    >
                      {/* Top Row: Title, ID & Status */}
                      <div>
                        <div className="flex justify-between items-start gap-4 mb-4">
                          <div>
                            <span className="text-[10px] font-mono text-cyan-400/85">PROPOSAL ID #{Number(p.id)}</span>
                            <h3 className="text-lg font-bold text-white group-hover:text-cyan-400 transition-colors mt-0.5">{p.project_name}</h3>
                          </div>
                          {getStatusBadge(p.status)}
                        </div>

                        {/* Description */}
                        <p className="text-sm text-slate-400 line-clamp-3 mb-6 leading-relaxed">
                          {p.pitch_description}
                        </p>

                        {/* AI Scores Summary (if evaluated) */}
                        {hasMemo && memo ? (
                          <div className="grid grid-cols-3 gap-3 p-3 bg-slate-950/40 rounded-xl border border-slate-800/50 mb-6 text-center">
                            <div>
                              <p className="text-[9px] text-slate-500 uppercase font-bold tracking-wider">Technical</p>
                              <p className={`text-base font-bold font-mono mt-0.5 ${getScoreColor(memo.technical_score)}`}>
                                {memo.technical_score}/100
                              </p>
                            </div>
                            <div>
                              <p className="text-[9px] text-slate-500 uppercase font-bold tracking-wider">Market</p>
                              <p className={`text-base font-bold font-mono mt-0.5 ${getScoreColor(memo.market_score)}`}>
                                {memo.market_score}/100
                              </p>
                            </div>
                            <div>
                              <p className="text-[9px] text-slate-500 uppercase font-bold tracking-wider">Scam Risk</p>
                              <p className={`text-base font-bold font-mono mt-0.5 ${getScamColor(memo.scam_probability)}`}>
                                {memo.scam_probability}%
                              </p>
                            </div>
                          </div>
                        ) : (
                          <div className="p-3 bg-slate-950/20 rounded-xl border border-dashed border-slate-800/60 mb-6 text-center text-xs text-slate-500 font-semibold">
                            No AI Score available. Evaluate proposal to audit.
                          </div>
                        )}

                        {/* Voting Weights (if active) */}
                        {Number(p.status) === 1 && (
                          <div className="mb-6">
                            <div className="flex justify-between text-xs text-slate-400 mb-1.5">
                              <span>YES: {voteStats.yes.toLocaleString()} GEN ({yesPercent.toFixed(1)}%)</span>
                              <span>NO: {voteStats.no.toLocaleString()} GEN</span>
                            </div>
                            <div className="h-1.5 w-full bg-slate-850 rounded-full overflow-hidden flex">
                              <div className="h-full bg-emerald-400" style={{ width: `${yesPercent}%` }} />
                              <div className="h-full bg-rose-500" style={{ width: `${100 - yesPercent}%` }} />
                            </div>
                          </div>
                        )}
                      </div>

                      {/* Bottom row details */}
                      <div className="border-t border-slate-800/80 pt-4 flex items-center justify-between gap-4">
                        <div className="flex items-center gap-1 text-slate-400 text-xs">
                          <DollarSign className="w-3.5 h-3.5 text-cyan-400" />
                          <span className="font-semibold text-slate-200">{Number(p.funding_requested).toLocaleString()}</span> GEN
                        </div>

                        {/* Action buttons */}
                        <div className="flex gap-2">
                          {Number(p.status) === 0 && (
                            <button
                              onClick={() => handleTriggerAI(p.id)}
                              className="px-4 py-2 rounded-lg bg-cyan-500 text-slate-900 text-xs font-bold hover:bg-cyan-400 active:scale-95 transition-all flex items-center gap-1.5"
                            >
                              <Terminal className="w-3.5 h-3.5" /> Execute AI Audit
                            </button>
                          )}
                          <button
                            onClick={() => setSelectedProposalId(p.id)}
                            className="px-3.5 py-2 rounded-lg bg-slate-800 text-slate-200 text-xs font-bold hover:bg-slate-700 transition-all border border-slate-700/60 flex items-center gap-1"
                          >
                            Details <ArrowRight className="w-3 h-3" />
                          </button>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* ======================================================== */}
        {/* POPUP/TERMINAL LOGS FOR RUNNING AI ANALYSIS */}
        {/* ======================================================== */}
        {aiAnalyzingId !== null && (
          <div className="fixed inset-0 bg-[#000]/80 z-50 flex items-center justify-center p-4 backdrop-blur-sm">
            <div className="w-full max-w-2xl bg-slate-950 rounded-2xl border border-cyan-500/40 overflow-hidden shadow-2xl shadow-cyan-500/10">
              <div className="bg-slate-900 px-6 py-4 flex justify-between items-center border-b border-slate-800">
                <div className="flex items-center gap-2">
                  <Loader2 className="w-4 h-4 text-cyan-400 animate-spin" />
                  <span className="font-bold text-sm text-cyan-400 font-mono uppercase tracking-wider">GenVM Intelligent Agent Execution</span>
                </div>
                <span className="text-xs text-slate-500 font-mono">Proposal ID #{Number(aiAnalyzingId)}</span>
              </div>
              <div className="p-6 bg-black font-mono text-xs text-slate-300 h-80 overflow-y-auto space-y-2.5">
                {aiLogs.map((log, idx) => (
                  <div 
                    key={idx} 
                    className={`${log.includes('[SUCCESS]') ? 'text-emerald-400 font-bold' : log.includes('[TX SENT]') || log.includes('[LLM]') ? 'text-purple-400' : 'text-slate-300'}`}
                  >
                    {log}
                  </div>
                ))}
                {aiLogs.length > 0 && !aiLogs[aiLogs.length - 1].includes('[SUCCESS]') && !aiLogs[aiLogs.length - 1].includes('[ERROR]') && (
                  <div className="flex items-center gap-1 text-slate-500 italic mt-2">
                    <span>&gt; Processing blockchain equivalence consensus</span>
                    <span className="animate-ping">...</span>
                  </div>
                )}
              </div>
              <div className="bg-slate-900/60 px-6 py-3 border-t border-slate-850 flex justify-between items-center text-[10px] text-slate-500 font-mono">
                <span>Depends: py-genlayer:1jb45aa8...</span>
                <span>Runtime: GenVM v0.2.16</span>
              </div>
            </div>
          </div>
        )}

        {/* ======================================================== */}
        {/* TAB: PROPOSAL DETAIL PAGE (AI MEMO & VOTING) */}
        {/* ======================================================== */}
        {selectedProposalId !== null && (
          (() => {
            const p = proposals.find(pr => pr.id === selectedProposalId);
            const hasMemo = !!p.ai_memo;
            const memo = hasMemo ? JSON.parse(p.ai_memo) : null;
            const voteStats = votes[p.id] || { yes: 0, no: 0, voted: [] };
            const totalVotes = voteStats.yes + voteStats.no;
            const yesPercent = totalVotes > 0 ? (voteStats.yes / totalVotes) * 100 : 0;
            const noPercent = totalVotes > 0 ? (voteStats.no / totalVotes) * 100 : 0;

            return (
              <div>
                <button
                  onClick={() => setSelectedProposalId(null)}
                  className="mb-6 text-slate-400 hover:text-slate-200 text-sm flex items-center gap-1 font-semibold"
                >
                  &larr; Back to Explore
                </button>

                <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                  {/* Left Column: Startup details and AI analyst memo */}
                  <div className="lg:col-span-2 space-y-6">
                    <div className="glass-panel rounded-2xl p-6 border border-slate-800/80">
                      <div className="flex flex-col sm:flex-row justify-between items-start gap-4 mb-4">
                        <div>
                          <span className="text-xs font-mono text-cyan-400">PROPOSAL #{Number(p.id)}</span>
                          <h2 className="text-2xl font-bold text-white mt-1">{p.project_name}</h2>
                          <p className="text-xs text-slate-500 mt-2 font-mono flex items-center gap-1.5">
                            <User className="w-3.5 h-3.5 text-cyan-400/85" /> Proposer: {p.proposer}
                          </p>
                        </div>
                        {getStatusBadge(p.status)}
                      </div>

                      <p className="text-slate-300 text-sm leading-relaxed mb-6 whitespace-pre-line bg-slate-950/20 p-4 rounded-xl border border-slate-900">
                        {p.pitch_description}
                      </p>

                      {/* Links Row */}
                      <div className="flex flex-wrap gap-4 text-xs font-semibold">
                        {p.website_url && (
                          <a href={p.website_url} target="_blank" rel="noreferrer" className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-900 border border-slate-800 text-slate-300 hover:text-cyan-400 hover:border-cyan-500/20 transition-all">
                            <Globe className="w-3.5 h-3.5 text-slate-400" /> Website <ExternalLink className="w-3 h-3" />
                          </a>
                        )}
                        {p.github_url && (
                          <a href={p.github_url} target="_blank" rel="noreferrer" className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-900 border border-slate-800 text-slate-300 hover:text-cyan-400 hover:border-cyan-500/20 transition-all">
                            <Code className="w-3.5 h-3.5 text-slate-400" /> GitHub <ExternalLink className="w-3 h-3" />
                          </a>
                        )}
                        {p.whitepaper_url && (
                          <a href={p.whitepaper_url} target="_blank" rel="noreferrer" className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-900 border border-slate-800 text-slate-300 hover:text-cyan-400 hover:border-cyan-500/20 transition-all">
                            <FileText className="w-3.5 h-3.5 text-slate-400" /> Whitepaper <ExternalLink className="w-3 h-3" />
                          </a>
                        )}
                        {p.twitter_url && (
                          <a href={p.twitter_url} target="_blank" rel="noreferrer" className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-900 border border-slate-800 text-slate-300 hover:text-cyan-400 hover:border-cyan-500/20 transition-all">
                            <Share2 className="w-3.5 h-3.5 text-slate-400" /> Twitter <ExternalLink className="w-3 h-3" />
                          </a>
                        )}
                      </div>
                    </div>

                    {/* AI ANALYST MEMO SECTION */}
                    {hasMemo && memo ? (
                      <div className="glass-panel rounded-2xl p-6 border-slate-800/80 relative overflow-hidden">
                        
                        {/* Glow indicator based on recommendation */}
                        <div className={`absolute top-0 right-0 w-24 h-24 rounded-full blur-[40px] pointer-events-none opacity-30 ${memo.recommendation === 'INVEST' ? 'bg-emerald-500' : 'bg-rose-500'}`} />

                        <div className="flex justify-between items-center mb-6">
                          <h3 className="text-base font-bold text-white uppercase tracking-wider flex items-center gap-2">
                            <Cpu className="w-5 h-5 text-cyan-400" /> AI Analyst Investment Memo
                          </h3>
                          <div className={`px-4 py-1.5 rounded-xl border font-mono font-bold text-sm tracking-wide ${
                            memo.recommendation === 'INVEST' 
                              ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30' 
                              : 'bg-rose-500/10 text-rose-400 border-rose-500/30'
                          }`}>
                            RECOMMENDATION: {memo.recommendation}
                          </div>
                        </div>

                        {/* Scores grid */}
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
                          <div className="bg-slate-950/50 p-3 rounded-xl border border-slate-900 text-center">
                            <span className="text-[10px] text-slate-500 uppercase font-bold">Confidence</span>
                            <p className="text-xl font-bold font-mono text-cyan-400 mt-1">{memo.confidence}%</p>
                          </div>
                          <div className="bg-slate-950/50 p-3 rounded-xl border border-slate-900 text-center">
                            <span className="text-[10px] text-slate-500 uppercase font-bold">Technical Quality</span>
                            <p className={`text-xl font-bold font-mono mt-1 ${getScoreColor(memo.technical_score)}`}>{memo.technical_score}/100</p>
                          </div>
                          <div className="bg-slate-950/50 p-3 rounded-xl border border-slate-900 text-center">
                            <span className="text-[10px] text-slate-500 uppercase font-bold">Market Score</span>
                            <p className={`text-xl font-bold font-mono mt-1 ${getScoreColor(memo.market_score)}`}>{memo.market_score}/100</p>
                          </div>
                          <div className="bg-slate-950/50 p-3 rounded-xl border border-slate-900 text-center">
                            <span className="text-[10px] text-slate-500 uppercase font-bold">Scam Risk</span>
                            <p className={`text-xl font-bold font-mono mt-1 ${getScamColor(memo.scam_probability)}`}>{memo.scam_probability}%</p>
                          </div>
                        </div>

                        {/* Analysis Text Summary */}
                        <div className="mb-6">
                          <h4 className="text-xs text-slate-400 uppercase font-bold tracking-wider mb-2">Executive Summary</h4>
                          <p className="text-sm text-slate-300 leading-relaxed bg-slate-950/20 p-4 rounded-xl border border-slate-900">
                            {memo.summary}
                          </p>
                        </div>

                        {/* Strengths and Weaknesses */}
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
                          <div>
                            <h4 className="text-xs text-emerald-400 uppercase font-bold tracking-wider mb-3 flex items-center gap-1">
                              <CheckCircle2 className="w-4 h-4 text-emerald-400" /> Key Strengths
                            </h4>
                            <ul className="space-y-2 text-sm text-slate-350 list-disc pl-4 leading-relaxed">
                              {memo.strengths.map((str, i) => <li key={i}>{str}</li>)}
                            </ul>
                          </div>
                          <div>
                            <h4 className="text-xs text-amber-400 uppercase font-bold tracking-wider mb-3 flex items-center gap-1">
                              <AlertTriangle className="w-4 h-4 text-amber-400" /> Areas of Concern
                            </h4>
                            <ul className="space-y-2 text-sm text-slate-350 list-disc pl-4 leading-relaxed">
                              {memo.weaknesses.map((weak, i) => <li key={i}>{weak}</li>)}
                            </ul>
                          </div>
                        </div>

                        {/* Risks */}
                        <div>
                          <h4 className="text-xs text-rose-400 uppercase font-bold tracking-wider mb-3 flex items-center gap-1">
                            <XCircle className="w-4 h-4 text-rose-400" /> Risk Analysis
                          </h4>
                          <ul className="space-y-2 text-sm text-slate-350 list-disc pl-4 leading-relaxed">
                            {memo.risks.map((risk, i) => <li key={i}>{risk}</li>)}
                          </ul>
                        </div>

                      </div>
                    ) : (
                      <div className="p-8 text-center bg-slate-900/20 rounded-2xl border border-dashed border-slate-800">
                        <Terminal className="w-10 h-10 text-slate-600 mx-auto mb-3" />
                        <h3 className="font-semibold text-slate-300 mb-1">Proposal Awaiting AI Analysis</h3>
                        <p className="text-xs text-slate-500 max-w-sm mx-auto mb-4">
                          No evaluation scores are recorded. Run the AI Analyst execution step to scrape documentation and generate the VC assessment.
                        </p>
                        <button
                          onClick={() => handleTriggerAI(p.id)}
                          className="px-5 py-2.5 rounded-xl bg-cyan-500 text-slate-900 text-xs font-bold hover:bg-cyan-400 active:scale-95 transition-all flex items-center gap-1.5 mx-auto"
                        >
                          <Terminal className="w-4 h-4" /> Run AI Analyst Auditor
                        </button>
                      </div>
                    )}
                  </div>

                  {/* Right Column: Governance, Staking & Actions */}
                  <div className="space-y-6">
                    
                    {/* Proposal Financials Panel */}
                    <div className="glass-panel rounded-2xl p-6 border-slate-800/80">
                      <h3 className="text-sm text-slate-400 uppercase font-bold tracking-wider mb-4">Proposal Financials</h3>
                      <div className="space-y-4">
                        <div className="flex justify-between items-center p-3 bg-slate-950/40 rounded-xl border border-slate-900">
                          <span className="text-xs text-slate-400">Funding Requested</span>
                          <span className="text-lg font-bold font-mono text-cyan-400">{Number(p.funding_requested).toLocaleString()} GEN</span>
                        </div>
                        <div className="flex justify-between items-center p-3 bg-slate-950/40 rounded-xl border border-slate-900">
                          <span className="text-xs text-slate-400">DAO Treasury Balance</span>
                          <span className="text-sm font-semibold text-slate-300">{treasuryBalance.toLocaleString()} GEN</span>
                        </div>
                      </div>
                    </div>

                    {/* Governance Stance & Voting */}
                    {Number(p.status) === 1 && (
                      <div className="glass-panel rounded-2xl p-6 border border-emerald-500/20 shadow-lg shadow-emerald-950/5">
                        <h3 className="text-sm text-slate-200 uppercase font-bold tracking-wider mb-4 flex items-center gap-1.5">
                          <Vote className="w-5 h-5 text-emerald-400" /> Active Voting Panel
                        </h3>

                        {/* Voting statistics */}
                        <div className="space-y-3 mb-6 bg-slate-950/50 p-4 rounded-xl border border-slate-900">
                          <div>
                            <div className="flex justify-between text-xs text-slate-400 mb-1">
                              <span>YES: {voteStats.yes.toLocaleString()} GEN</span>
                              <span className="font-semibold text-emerald-400">{yesPercent.toFixed(1)}%</span>
                            </div>
                            <div className="h-2 w-full bg-slate-900 rounded-full overflow-hidden">
                              <div className="h-full bg-emerald-400" style={{ width: `${yesPercent}%` }} />
                            </div>
                          </div>
                          <div>
                            <div className="flex justify-between text-xs text-slate-400 mb-1">
                              <span>NO: {voteStats.no.toLocaleString()} GEN</span>
                              <span className="font-semibold text-rose-400">{noPercent.toFixed(1)}%</span>
                            </div>
                            <div className="h-2 w-full bg-slate-900 rounded-full overflow-hidden">
                              <div className="h-full bg-rose-500" style={{ width: `${noPercent}%` }} />
                            </div>
                          </div>
                          <div className="border-t border-slate-900 pt-2.5 flex justify-between text-[11px] text-slate-500 font-mono">
                            <span>Voters casted: {voteStats.voted.length}</span>
                            <span>Total Stake Weight: {totalVotes.toLocaleString()} GEN</span>
                          </div>
                        </div>

                        {/* User action */}
                        {userVoteWeight > 0 ? (
                          <div className="space-y-4">
                            <p className="text-xs text-slate-400 text-center leading-relaxed">
                              You have a voting power of <span className="font-semibold text-cyan-400">{userVoteWeight.toLocaleString()} GEN</span> based on your current staked balance.
                            </p>
                            <div className="grid grid-cols-2 gap-3">
                              <button
                                onClick={() => handleVote(p.id, true)}
                                className="py-3 px-4 bg-emerald-500 hover:bg-emerald-400 text-slate-900 rounded-xl font-bold text-xs uppercase tracking-wide transition-all active:scale-95"
                              >
                                Support (YES)
                              </button>
                              <button
                                onClick={() => handleVote(p.id, false)}
                                className="py-3 px-4 bg-rose-500 hover:bg-rose-400 text-slate-900 rounded-xl font-bold text-xs uppercase tracking-wide transition-all active:scale-95"
                              >
                                Reject (NO)
                              </button>
                            </div>

                            {/* Finalize step */}
                            <button
                              onClick={() => handleFinalize(p.id)}
                              className="w-full py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700/60 rounded-xl text-xs font-bold transition-all mt-4"
                            >
                              Finalize Voting Period
                            </button>
                          </div>
                        ) : (
                          <div className="text-center p-4 bg-rose-950/10 rounded-xl border border-rose-900/20 text-xs text-rose-300">
                            You do not have any staked tokens. Stake GEN in the Staking tab to gain voting power.
                          </div>
                        )}
                      </div>
                    )}

                    {/* Proposal Results summary */}
                    {Number(p.status) > 1 && (
                      <div className="glass-panel rounded-2xl p-6 border-slate-800/80">
                        <h3 className="text-sm text-slate-400 uppercase font-bold tracking-wider mb-4">Governance Outcome</h3>
                        <div className="space-y-3">
                          <div className="flex justify-between items-center p-3 bg-slate-950/40 rounded-xl border border-slate-900 text-xs">
                            <span className="text-slate-400">Final Outcome</span>
                            <span className={`font-bold ${Number(p.status) === 3 ? 'text-emerald-400' : 'text-rose-400'}`}>
                              {Number(p.status) === 3 ? 'PASSED & FUNDED' : 'DEFEATED'}
                            </span>
                          </div>
                          <div className="flex justify-between items-center p-3 bg-slate-950/40 rounded-xl border border-slate-900 text-xs">
                            <span className="text-slate-400">Total Yes Votes</span>
                            <span className="font-semibold text-slate-350">{voteStats.yes.toLocaleString()} GEN</span>
                          </div>
                          <div className="flex justify-between items-center p-3 bg-slate-950/40 rounded-xl border border-slate-900 text-xs">
                            <span className="text-slate-400">Total No Votes</span>
                            <span className="font-semibold text-slate-350">{voteStats.no.toLocaleString()} GEN</span>
                          </div>
                        </div>
                      </div>
                    )}

                  </div>
                </div>
              </div>
            );
          })()
        )}

        {/* ======================================================== */}
        {/* TAB: SUBMIT STARTUP PROPOSAL */}
        {/* ======================================================== */}
        {activeTab === 'submit' && (
          <div className="max-w-3xl mx-auto">
            <div className="glass-panel rounded-2xl p-8 border-slate-800/80">
              <div className="mb-6">
                <h2 className="text-xl font-bold text-white flex items-center gap-2">
                  <PlusCircle className="w-5 h-5 text-cyan-400" /> Submit Startup Proposal
                </h2>
                <p className="text-xs text-slate-500 mt-1.5">
                  Propose your project for funding. After submission, the GenLayer AI Analyst will scrape your website, github, and whitepaper to generate a risk-reward scoring memo.
                </p>
              </div>

              <form onSubmit={handleSubmitProposal} className="space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  {/* Project Name */}
                  <div className="space-y-2">
                    <label className="text-xs text-slate-400 font-bold uppercase tracking-wider">Project Name *</label>
                    <input 
                      type="text"
                      name="projectName"
                      required
                      placeholder="e.g. Aegis Compliance Layer"
                      value={formData.projectName}
                      onChange={handleFormChange}
                      className="w-full bg-[#0a0c10] border border-slate-800 rounded-xl py-3 px-4 text-sm text-slate-200 focus:outline-none focus:border-cyan-500/60 focus:ring-1 focus:ring-cyan-500/20 transition-all placeholder:text-slate-600"
                    />
                  </div>

                  {/* Requested Funding */}
                  <div className="space-y-2">
                    <label className="text-xs text-slate-400 font-bold uppercase tracking-wider">Requested Funding (GEN) *</label>
                    <input 
                      type="number"
                      name="fundingRequested"
                      required
                      placeholder="e.g. 50000"
                      value={formData.fundingRequested}
                      onChange={handleFormChange}
                      className="w-full bg-[#0a0c10] border border-slate-800 rounded-xl py-3 px-4 text-sm text-slate-200 focus:outline-none focus:border-cyan-500/60 focus:ring-1 focus:ring-cyan-500/20 transition-all placeholder:text-slate-600"
                    />
                  </div>
                </div>

                {/* Website and Twitter */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="space-y-2">
                    <label className="text-xs text-slate-400 font-bold uppercase tracking-wider">Website URL</label>
                    <input 
                      type="url"
                      name="websiteUrl"
                      placeholder="https://yourstartup.com"
                      value={formData.websiteUrl}
                      onChange={handleFormChange}
                      className="w-full bg-[#0a0c10] border border-slate-800 rounded-xl py-3 px-4 text-sm text-slate-200 focus:outline-none focus:border-cyan-500/60 focus:ring-1 focus:ring-cyan-500/20 transition-all placeholder:text-slate-600"
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-xs text-slate-400 font-bold uppercase tracking-wider">Twitter URL</label>
                    <input 
                      type="url"
                      name="twitterUrl"
                      placeholder="https://x.com/yourstartup"
                      value={formData.twitterUrl}
                      onChange={handleFormChange}
                      className="w-full bg-[#0a0c10] border border-slate-800 rounded-xl py-3 px-4 text-sm text-slate-200 focus:outline-none focus:border-cyan-500/60 focus:ring-1 focus:ring-cyan-500/20 transition-all placeholder:text-slate-600"
                    />
                  </div>
                </div>

                {/* GitHub and Whitepaper */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="space-y-2">
                    <label className="text-xs text-slate-400 font-bold uppercase tracking-wider">GitHub Repo URL</label>
                    <input 
                      type="url"
                      name="githubUrl"
                      placeholder="https://github.com/yourstartup/core"
                      value={formData.githubUrl}
                      onChange={handleFormChange}
                      className="w-full bg-[#0a0c10] border border-slate-800 rounded-xl py-3 px-4 text-sm text-slate-200 focus:outline-none focus:border-cyan-500/60 focus:ring-1 focus:ring-cyan-500/20 transition-all placeholder:text-slate-600"
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-xs text-slate-400 font-bold uppercase tracking-wider">Whitepaper/Doc Link</label>
                    <input 
                      type="url"
                      name="whitepaperUrl"
                      placeholder="https://yourstartup.com/whitepaper.pdf"
                      value={formData.whitepaperUrl}
                      onChange={handleFormChange}
                      className="w-full bg-[#0a0c10] border border-slate-800 rounded-xl py-3 px-4 text-sm text-slate-200 focus:outline-none focus:border-cyan-500/60 focus:ring-1 focus:ring-cyan-500/20 transition-all placeholder:text-slate-600"
                    />
                  </div>
                </div>

                {/* Pitch description */}
                <div className="space-y-2">
                  <label className="text-xs text-slate-400 font-bold uppercase tracking-wider">Pitch Description & Core Tech *</label>
                  <textarea 
                    name="pitchDescription"
                    required
                    rows="5"
                    placeholder="Provide a detailed explanation of your product, blockchain architecture, token economics, and market feasibility..."
                    value={formData.pitchDescription}
                    onChange={handleFormChange}
                    className="w-full bg-[#0a0c10] border border-slate-800 rounded-xl py-3 px-4 text-sm text-slate-200 focus:outline-none focus:border-cyan-500/60 focus:ring-1 focus:ring-cyan-500/20 transition-all placeholder:text-slate-600 resize-none font-semibold placeholder:font-normal"
                  />
                </div>

                <div className="border-t border-slate-900 pt-6 flex justify-end gap-3">
                  <button
                    type="submit"
                    className="px-6 py-3 rounded-xl bg-gradient-to-r from-cyan-500 to-cyan-400 text-slate-900 font-bold text-sm hover:brightness-110 transition-all active:scale-95 shadow-md shadow-cyan-500/10"
                  >
                    Submit Proposal to DAO
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* ======================================================== */}
        {/* TAB: TREASURY AND STAKING */}
        {/* ======================================================== */}
        {activeTab === 'staking' && (
          <div className="space-y-8">
            
            {/* DAO Balance statistics */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div className="glass-panel rounded-2xl p-6 border-slate-800/80">
                <span className="text-xs text-slate-400 font-bold uppercase tracking-wider">DAO Treasury Balance</span>
                <p className="text-3xl font-extrabold font-mono text-cyan-400 mt-2">{treasuryBalance.toLocaleString()} GEN</p>
                <div className="flex items-center gap-1.5 text-xs text-slate-500 mt-3">
                  <TrendingUp className="w-4 h-4 text-slate-500" /> Max single investment capability
                </div>
              </div>
              <div className="glass-panel rounded-2xl p-6 border-slate-800/80">
                <span className="text-xs text-slate-400 font-bold uppercase tracking-wider">Total Tokens Staked</span>
                <p className="text-3xl font-extrabold font-mono text-slate-100 mt-2">{totalStaked.toLocaleString()} GEN</p>
                <div className="flex items-center gap-1.5 text-xs text-slate-500 mt-3">
                  <Shield className="w-4 h-4 text-slate-500" /> Active security staking
                </div>
              </div>
              <div className="glass-panel rounded-2xl p-6 border-slate-800/80">
                <span className="text-xs text-slate-400 font-bold uppercase tracking-wider">Your Staked Balance</span>
                <p className="text-3xl font-extrabold font-mono text-emerald-400 mt-2">{stakedBalance.toLocaleString()} GEN</p>
                <div className="flex items-center gap-1.5 text-xs text-slate-500 mt-3">
                  <Vote className="w-4 h-4 text-emerald-400" /> Voting Power: {userVoteWeight.toLocaleString()} GEN
                </div>
              </div>
            </div>

            {/* Forms Panel */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
              
              {/* Member Staking operations */}
              <div className="glass-panel rounded-2xl p-6 border-slate-800/80">
                <h3 className="text-base font-bold text-white mb-1 flex items-center gap-2">
                  <Coins className="w-5 h-5 text-cyan-400" /> Member Staking
                </h3>
                <p className="text-xs text-slate-500 mb-6">
                  Stake your GEN tokens to gain voting power inside the Venture DAO. Unstaked tokens are returned to your wallet immediately.
                </p>

                <div className="space-y-6">
                  {/* Stake Form */}
                  <form onSubmit={handleStake} className="space-y-2">
                    <label className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">Stake Tokens</label>
                    <div className="flex gap-2">
                      <input 
                        type="number"
                        placeholder="Amount to stake (e.g. 5000)"
                        value={stakeInput}
                        onChange={(e) => setStakeInput(e.target.value)}
                        className="flex-1 bg-[#0a0c10] border border-slate-800 rounded-xl py-2.5 px-4 text-sm text-slate-200 focus:outline-none focus:border-cyan-500/60 focus:ring-1 focus:ring-cyan-500/20 transition-all placeholder:text-slate-600"
                      />
                      <button 
                        type="submit"
                        className="px-5 py-2.5 rounded-xl bg-cyan-500 text-slate-900 font-bold text-xs hover:bg-cyan-400 transition-all"
                      >
                        Stake
                      </button>
                    </div>
                  </form>

                  {/* Unstake Form */}
                  <form onSubmit={handleUnstake} className="space-y-2">
                    <label className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">Unstake Tokens</label>
                    <div className="flex gap-2">
                      <input 
                        type="number"
                        placeholder="Amount to unstake"
                        value={unstakeInput}
                        onChange={(e) => setUnstakeInput(e.target.value)}
                        className="flex-1 bg-[#0a0c10] border border-slate-800 rounded-xl py-2.5 px-4 text-sm text-slate-200 focus:outline-none focus:border-cyan-500/60 focus:ring-1 focus:ring-cyan-500/20 transition-all placeholder:text-slate-600"
                      />
                      <button 
                        type="submit"
                        className="px-5 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700/60 font-bold text-xs transition-all"
                      >
                        Unstake
                      </button>
                    </div>
                  </form>
                </div>
              </div>

              {/* Fund Treasury panel */}
              <div className="glass-panel rounded-2xl p-6 border-slate-800/80">
                <h3 className="text-base font-bold text-white mb-1 flex items-center gap-2">
                  <TrendingUp className="w-5 h-5 text-cyan-400" /> LP Capital Allocation
                </h3>
                <p className="text-xs text-slate-500 mb-6">
                  LPs can deposit native GEN tokens directly into the DAO Treasury. Funds are only spent on projects approved by the governance votes.
                </p>

                <form onSubmit={handleDepositTreasury} className="space-y-4">
                  <div className="space-y-2">
                    <label className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">Deposit Capital (GEN)</label>
                    <div className="flex gap-2">
                      <input 
                        type="number"
                        placeholder="Amount to deposit"
                        value={depositInput}
                        onChange={(e) => setDepositInput(e.target.value)}
                        className="flex-1 bg-[#0a0c10] border border-slate-800 rounded-xl py-2.5 px-4 text-sm text-slate-200 focus:outline-none focus:border-cyan-500/60 focus:ring-1 focus:ring-cyan-500/20 transition-all placeholder:text-slate-600"
                      />
                      <button 
                        type="submit"
                        className="px-5 py-2.5 rounded-xl bg-cyan-500 text-slate-900 font-bold text-xs hover:bg-cyan-400 transition-all"
                      >
                        Deposit
                      </button>
                    </div>
                  </div>
                </form>
              </div>

            </div>
          </div>
        )}

        {/* ======================================================== */}
        {/* TAB: SETTINGS & RPC ENDPOINT CONFIG */}
        {/* ======================================================== */}
        {activeTab === 'settings' && (
          <div className="max-w-2xl mx-auto">
            <div className="glass-panel rounded-2xl p-8 border-slate-800/80">
              <div className="mb-6">
                <h2 className="text-xl font-bold text-white flex items-center gap-2">
                  <Settings className="w-5 h-5 text-cyan-400" /> Node Connection & RPC Config
                </h2>
                <p className="text-xs text-slate-500 mt-1.5">
                  Configure your connection. Toggle between the simulation sandbox and your deployed Intelligent Contract in the GenLayer Studio.
                </p>
              </div>

              <div className="space-y-6">
                {/* Connection Mode toggle */}
                <div className="space-y-2">
                  <label className="text-[10px] text-slate-400 font-bold uppercase tracking-wider block">Select Runtime Mode</label>
                  <div className="grid grid-cols-2 gap-2 bg-slate-950 p-1 rounded-xl border border-slate-850">
                    <button
                      onClick={() => { setConnectionMode('mock'); setIsNodeConnected(true); }}
                      className={`py-2 rounded-lg text-xs font-bold transition-all ${
                        connectionMode === 'mock' 
                          ? 'bg-slate-800 text-cyan-400 border border-slate-700/65 shadow-md' 
                          : 'text-slate-400 hover:text-slate-350'
                      }`}
                    >
                      Mock Simulation Mode
                    </button>
                    <button
                      onClick={() => setConnectionMode('live')}
                      className={`py-2 rounded-lg text-xs font-bold transition-all ${
                        connectionMode === 'live' 
                          ? 'bg-slate-850 text-emerald-400 border border-slate-700/65 shadow-md' 
                          : 'text-slate-400 hover:text-slate-350'
                      }`}
                    >
                      Live GenLayer Studio Node
                    </button>
                  </div>
                </div>

                {connectionMode === 'live' && (
                  <div className="space-y-4 pt-4 border-t border-slate-900 animate-fadeIn">
                    
                    {/* JSON RPC URL */}
                    <div className="space-y-2">
                      <label className="text-[10px] text-slate-400 font-bold uppercase tracking-wider block">JSON-RPC Provider Endpoint</label>
                      <input 
                        type="url"
                        value={rpcEndpoint}
                        onChange={(e) => setRpcEndpoint(e.target.value)}
                        className="w-full bg-[#0a0c10] border border-slate-800 rounded-xl py-2.5 px-4 text-xs font-mono text-slate-300 focus:outline-none focus:border-cyan-500/60 transition-all"
                      />
                      <span className="text-[10px] text-slate-500">Default GenLayer local RPC client is `http://localhost:4000` (or `http://localhost:8080`).</span>
                    </div>

                    {/* Contract Address */}
                    <div className="space-y-2">
                      <label className="text-[10px] text-slate-400 font-bold uppercase tracking-wider block">Intelligent Contract Address</label>
                      <input 
                        type="text"
                        value={contractAddress}
                        onChange={(e) => setContractAddress(e.target.value)}
                        className="w-full bg-[#0a0c10] border border-slate-800 rounded-xl py-2.5 px-4 text-xs font-mono text-slate-300 focus:outline-none focus:border-cyan-500/60 transition-all"
                      />
                      <span className="text-[10px] text-slate-500">The address generated by deploying `VentureDAO.py` in the Studio contract inspector.</span>
                    </div>

                    <button 
                      onClick={fetchBlockchainData}
                      className="w-full py-3 bg-gradient-to-r from-emerald-500 to-emerald-400 hover:brightness-110 text-slate-950 rounded-xl text-xs font-bold uppercase tracking-wider transition-all flex items-center justify-center gap-1.5"
                    >
                      <RefreshCw className="w-4 h-4" /> Connect & Verify Contract
                    </button>

                  </div>
                )}

                {connectionMode === 'mock' && (
                  <div className="p-4 bg-cyan-950/10 rounded-xl border border-cyan-800/10 text-xs text-cyan-400 leading-relaxed font-mono">
                    <p className="font-bold mb-1">=== SIMULATOR METADATA ===</p>
                    <p>Contract File: VentureDAO.py</p>
                    <p>Compiler Hash: py-genlayer:1jb45aa8ynh2a9c9xn3b7qqh8sm5q93hwfp7jqmwsfhh8jpz09h6</p>
                    <p>Network latency: 15ms (local loopback)</p>
                    <p>State: Zero consensus deviations detected across mock validators.</p>
                  </div>
                )}

              </div>
            </div>
          </div>
        )}

      </main>

      {/* Footer */}
      <footer className="border-t border-slate-800/40 bg-[#040508]/60 py-6 mt-12 text-center text-xs text-slate-500">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex flex-col md:flex-row justify-between items-center gap-4">
          <p>&copy; 2026 AI Venture Capital DAO. Open-source Intelligent Contracts.</p>
          <div className="flex gap-4 font-mono text-[10px] text-slate-600">
            <span>Runtime: GenVM v0.2.16</span>
            <span>State Sync: 100% (Consensus)</span>
          </div>
        </div>
      </footer>

    </div>
  );
}

export default App;

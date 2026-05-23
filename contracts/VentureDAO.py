# v0.2.16
# { "Depends": "py-genlayer:1jb45aa8ynh2a9c9xn3b7qqh8sm5q93hwfp7jqmwsfhh8jpz09h6" }

from genlayer import *
from dataclasses import dataclass
import json

@gl.evm.contract_interface
class _Recipient:
    pass

@allow_storage
@dataclass
class Proposal:
    id: u256
    proposer: Address
    project_name: str
    website_url: str
    github_url: str
    whitepaper_url: str
    twitter_url: str
    funding_requested: u256
    pitch_description: str
    status: u256  # 0 = Submitted, 1 = VotingActive, 2 = RejectedByAI, 3 = Funded, 4 = Defeated
    ai_memo: str  # JSON string of AI evaluation results

class Contract(gl.Contract):
    proposals: TreeMap[u256, Proposal]
    proposal_count: u256
    
    staked_balances: TreeMap[Address, u256]
    total_staked: u256
    
    votes_yes: TreeMap[u256, u256]
    votes_no: TreeMap[u256, u256]
    has_voted: TreeMap[str, bool]  # key: "{proposal_id}-{user_address}"
    
    treasury_balance: u256

    def __init__(self):
        # GenVM auto-initializes storage collections.
        # We do NOT assign or reassign TreeMap() or DynArray() here.
        self.proposal_count = u256(0)
        self.total_staked = u256(0)
        self.treasury_balance = u256(0)

    @gl.public.write
    def submit_proposal(
        self,
        project_name: str,
        website_url: str,
        github_url: str,
        whitepaper_url: str,
        twitter_url: str,
        funding_requested: u256,
        pitch_description: str
    ) -> u256:
        proposal_id = self.proposal_count
        proposer = gl.message.sender
        
        new_proposal = Proposal(
            id=proposal_id,
            proposer=proposer,
            project_name=project_name,
            website_url=website_url,
            github_url=github_url,
            whitepaper_url=whitepaper_url,
            twitter_url=twitter_url,
            funding_requested=funding_requested,
            pitch_description=pitch_description,
            status=u256(0),
            ai_memo=""
        )
        
        self.proposals[proposal_id] = new_proposal
        self.proposal_count = proposal_id + u256(1)
        return proposal_id

    @gl.public.write
    def stake_tokens(self) -> None:
        amount = gl.message.value
        if amount > 0:
            sender = gl.message.sender
            current_stake = self.staked_balances.get(sender, u256(0))
            self.staked_balances[sender] = current_stake + amount
            self.total_staked = self.total_staked + amount

    @gl.public.write
    def unstake_tokens(self, amount: u256) -> None:
        sender = gl.message.sender
        current_stake = self.staked_balances.get(sender, u256(0))
        assert current_stake >= amount, "Insufficient staked balance"
        
        self.staked_balances[sender] = current_stake - amount
        self.total_staked = self.total_staked - amount
        
        # Transfer GEN tokens back to the staker
        _Recipient(sender).emit_transfer(value=amount)

    @gl.public.write
    def deposit_treasury(self) -> None:
        amount = gl.message.value
        self.treasury_balance = self.treasury_balance + amount

    @gl.public.write
    def evaluate_proposal(self, proposal_id: u256) -> None:
        proposal = self.proposals.get(proposal_id, None)
        assert proposal is not None, "Proposal not found"
        assert proposal.status == u256(0), "Proposal not in Submitted status"
        
        # Capture variables for the closure functions
        project_name = proposal.project_name
        pitch_description = proposal.pitch_description
        website_url = proposal.website_url
        github_url = proposal.github_url
        whitepaper_url = proposal.whitepaper_url
        funding_requested = proposal.funding_requested
        
        def leader_fn():
            website_content = ""
            github_content = ""
            whitepaper_content = ""
            
            # Fetch website content, github files/repos, and whitepaper if provided
            if website_url:
                website_content = gl.nondet.web.render(website_url, mode='text')
            if github_url:
                github_content = gl.nondet.web.render(github_url, mode='text')
            if whitepaper_url:
                whitepaper_content = gl.nondet.web.render(whitepaper_url, mode='text')
                
            prompt = f"""
            You are an expert Web3 Venture Capital Analyst. Analyze the following startup proposal:
            Project Name: {project_name}
            Description: {pitch_description}
            Website Content (snippet): {website_content[:2000]}
            GitHub Content (snippet): {github_content[:2000]}
            Whitepaper Content (snippet): {whitepaper_content[:2000]}
            Requested Funding: {int(funding_requested)} GEN.
            
            Evaluate the following aspects:
            1. Technical quality of the codebase or pitch
            2. Innovation and uniqueness
            3. Scam probability (is it a clone, low effort rug risk, etc.)
            4. Market potential and target addressable market
            5. Token utility and tokenomics soundness
            
            Respond ONLY in the following strict JSON format:
            {{
              "recommendation": "INVEST" or "PASS",
              "confidence": <integer between 0 and 100>,
              "technical_score": <integer between 0 and 100>,
              "market_score": <integer between 0 and 100>,
              "scam_probability": <integer between 0 and 100>,
              "summary": "<comprehensive 2-3 sentence analysis summary>",
              "strengths": ["strength 1", "strength 2"],
              "weaknesses": ["weakness 1", "weakness 2"],
              "risks": ["risk 1", "risk 2"]
            }}
            """
            return gl.nondet.exec_prompt(prompt, response_format='json')

        def validator_fn(leader_result) -> bool:
            if not isinstance(leader_result, gl.vm.Return):
                return False
            data = leader_result.calldata
            if not isinstance(data, dict):
                return False
                
            # Verify the required keys are present
            required_keys = ["recommendation", "confidence", "technical_score", "market_score", "scam_probability", "summary", "strengths", "weaknesses", "risks"]
            for key in required_keys:
                if key not in data:
                    return False
                    
            # Enforce types and limits
            if data["recommendation"] not in ["INVEST", "PASS"]:
                return False
            if not isinstance(data["confidence"], int) or not (0 <= data["confidence"] <= 100):
                return False
            if not isinstance(data["technical_score"], int) or not (0 <= data["technical_score"] <= 100):
                return False
            if not isinstance(data["market_score"], int) or not (0 <= data["market_score"] <= 100):
                return False
            if not isinstance(data["scam_probability"], int) or not (0 <= data["scam_probability"] <= 100):
                return False
            if not isinstance(data["summary"], str):
                return False
            if not isinstance(data["strengths"], list):
                return False
            if not isinstance(data["weaknesses"], list):
                return False
            if not isinstance(data["risks"], list):
                return False
                
            return True

        # Call run_nondet_unsafe
        result = gl.vm.run_nondet_unsafe(leader_fn, validator_fn)
        
        # Save analysis
        proposal.ai_memo = json.dumps(result)
        
        if result["recommendation"] == "INVEST":
            proposal.status = u256(1)  # VotingActive
            self.votes_yes[proposal_id] = u256(0)
            self.votes_no[proposal_id] = u256(0)
        else:
            proposal.status = u256(2)  # RejectedByAI
            
        self.proposals[proposal_id] = proposal

    @gl.public.write
    def vote_on_proposal(self, proposal_id: u256, support: bool) -> None:
        proposal = self.proposals.get(proposal_id, None)
        assert proposal is not None, "Proposal not found"
        assert proposal.status == u256(1), "Voting is not active on this proposal"
        
        voter = gl.message.sender
        voter_stake = self.staked_balances.get(voter, u256(0))
        assert voter_stake > 0, "Voter has no staked balance"
        
        vote_key = f"{proposal_id}-{voter}"
        assert not self.has_voted.get(vote_key, False), "Voter has already voted on this proposal"
        
        self.has_voted[vote_key] = True
        
        if support:
            self.votes_yes[proposal_id] = self.votes_yes.get(proposal_id, u256(0)) + voter_stake
        else:
            self.votes_no[proposal_id] = self.votes_no.get(proposal_id, u256(0)) + voter_stake

    @gl.public.write
    def finalize_proposal(self, proposal_id: u256) -> None:
        proposal = self.proposals.get(proposal_id, None)
        assert proposal is not None, "Proposal not found"
        assert proposal.status == u256(1), "Proposal is not in VotingActive status"
        
        yes_votes = self.votes_yes.get(proposal_id, u256(0))
        no_votes = self.votes_no.get(proposal_id, u256(0))
        
        # Proposal passes if yes_votes > no_votes and there is quorum (yes_votes > 0)
        if yes_votes > no_votes:
            funding_requested = proposal.funding_requested
            assert self.treasury_balance >= funding_requested, "Insufficient treasury balance"
            
            self.treasury_balance = self.treasury_balance - funding_requested
            proposal.status = u256(3)  # Funded
            
            # Send funds to the proposer
            _Recipient(proposal.proposer).emit_transfer(value=funding_requested)
        else:
            proposal.status = u256(4)  # Defeated
            
        self.proposals[proposal_id] = proposal

    @gl.public.view
    def get_proposal_count(self) -> u256:
        return self.proposal_count

    @gl.public.view
    def get_proposal_json(self, proposal_id: u256) -> str:
        if proposal_id >= self.proposal_count:
            return ""
            
        proposal = self.proposals.get(proposal_id, None)
        if proposal is None:
            return ""
            
        clean_name = proposal.project_name.replace('"', '\\"')
        clean_desc = proposal.pitch_description.replace('"', '\\"')
        ai_memo_json = proposal.ai_memo if proposal.ai_memo else "{}"
        proposer_str = str(proposal.proposer)
        
        return (
            f'{{"id": {int(proposal.id)}, '
            f'"proposer": "{proposer_str}", '
            f'"project_name": "{clean_name}", '
            f'"website_url": "{proposal.website_url}", '
            f'"github_url": "{proposal.github_url}", '
            f'"whitepaper_url": "{proposal.whitepaper_url}", '
            f'"twitter_url": "{proposal.twitter_url}", '
            f'"funding_requested": {int(proposal.funding_requested)}, '
            f'"pitch_description": "{clean_desc}", '
            f'"status": {int(proposal.status)}, '
            f'"ai_memo": {ai_memo_json}}}'
        )

    @gl.public.view
    def get_staked_balance(self, user: Address) -> u256:
        return self.staked_balances.get(user, u256(0))

    @gl.public.view
    def get_total_staked(self) -> u256:
        return self.total_staked

    @gl.public.view
    def get_treasury_balance(self) -> u256:
        return self.treasury_balance

    @gl.public.view
    def get_proposal_votes(self, proposal_id: u256) -> str:
        yes_votes = self.votes_yes.get(proposal_id, u256(0))
        no_votes = self.votes_no.get(proposal_id, u256(0))
        return f'{{"yes": {int(yes_votes)}, "no": {int(no_votes)}}}'

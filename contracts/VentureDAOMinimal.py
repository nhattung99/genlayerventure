# v0.2.16
# { "Depends": "py-genlayer:1jb45aa8ynh2a9c9xn3b7qqh8sm5q93hwfp7jqmwsfhh8jpz09h6" }

from genlayer import *
from dataclasses import dataclass

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
    status: u256  # 0 = Submitted, 1 = UnderAIReview, 2 = AIApproved, 3 = AIRejected, 4 = VotingStarted, 5 = Funded, 6 = Rejected

class Contract(gl.Contract):
    proposals: TreeMap[u256, Proposal]
    proposal_count: u256

    def __init__(self):
        # GenVM auto-initializes storage collections.
        # We do NOT assign or reassign TreeMap() or DynArray() here.
        self.proposal_count = u256(0)

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
            status=u256(0)
        )
        
        self.proposals[proposal_id] = new_proposal
        self.proposal_count = proposal_id + u256(1)
        return proposal_id

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
            
        # Clean double quotes to prevent breaking the manually constructed JSON string
        clean_name = proposal.project_name.replace('"', '\\"')
        clean_desc = proposal.pitch_description.replace('"', '\\"')
        
        return (
            f'{{"id": {int(proposal.id)}, '
            f'"proposer": "{str(proposal.proposer)}", '
            f'"project_name": "{clean_name}", '
            f'"website_url": "{proposal.website_url}", '
            f'"github_url": "{proposal.github_url}", '
            f'"whitepaper_url": "{proposal.whitepaper_url}", '
            f'"twitter_url": "{proposal.twitter_url}", '
            f'"funding_requested": {int(proposal.funding_requested)}, '
            f'"pitch_description": "{clean_desc}", '
            f'"status": {int(proposal.status)}}}'
        )

from scipy import sparse
import trimesh
import numpy as np
from PIL import Image
from io import BytesIO
from OffscreenRenderer.flat_renderer import FlatRenderer
import glm


class UpperBodySMPL:
    def __init__(self):
        self.uv_map_matrix = sparse.load_npz("./assets/smpl/long_sleeve.npz")
        model = trimesh.load("assets/smpl/smpl_female_upperbody.obj")
        self.f_uv = model.faces
        self.uv = model.visual.uv
        self.texPath = './assets/color_pattern/board_300x300.png'
        self.flat_render = None  # FlatRenderer(texPath=self.texPath)
        self.base_render = None  # BaseRenderer()
        self.uv_render = None
        self.model = np.array(glm.mat4(1).to_list())
        self.view = np.array(glm.mat4(1).to_list())


    def render(self, verts,height=512,width=512):
        projection = np.array(glm.perspective(np.pi / 3, width / height, 0.1, 100).to_list())
        if self.flat_render is None:
            self.flat_render = FlatRenderer(texPath=self.texPath,height=height,width=width)
        #print(verts.shape)
        #print(self.uv_map_matrix.shape)
        amputated_verts = self.uv_map_matrix.dot(verts)
        return self.flat_render.render(amputated_verts, self.uv/16,self.f_uv.reshape(-1),self.model,self.view,projection)



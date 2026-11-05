import numpy as np

def get_inverse_trans(trans):
    full_matrix = np.vstack([trans, [0, 0, 1]])

    # Compute the inverse of the 3x3 matrix
    inverse_matrix = np.linalg.inv(full_matrix)

    # Extract the top 2 rows for use with cv2.warpAffine
    inverse_transform_matrix = inverse_matrix[:2, :]
    return inverse_transform_matrix

class TemporalSmoothing:
    def __init__(self, c=0.8):
        self.past_trans=None
        self.c=c

    def __call__(self, trans):
        if self.past_trans is None:
            self.past_trans = trans.copy()
            return trans, get_inverse_trans(trans)
        else:
            if trans is not None:
                trans = trans*(1-self.c)+self.past_trans*self.c
                self.past_trans = trans.copy()
                return trans,get_inverse_trans(trans)
            else:
                return self.past_trans.copy(), get_inverse_trans(self.past_trans.copy())
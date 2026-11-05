from util.pixel_align import get_threshold_mask
import numpy as np
from scipy.ndimage import gaussian_filter
import cv2

def naive_overlay(raw_img, raw_target):
    np_mask = get_threshold_mask(raw_target)
    composed = raw_img.copy()
    condition = np_mask>0.5
    composed[condition]=raw_target[condition]
    return composed

def naive_overlay_alpha(raw_img, raw_target, raw_alpha):
    raw_alpha=(raw_alpha>128).astype(np.uint8)*255
    raw_alpha=erode(raw_alpha)
    raw_alpha=raw_alpha.astype(np.float32)/255.0
    raw_alpha=np.expand_dims(raw_alpha,2)
    raw_alpha=raw_alpha[:,:,[0,0,0]]
    raw_img=raw_img.astype(np.float32)
    raw_target=raw_target.astype(np.float32)
    composed=raw_target*raw_alpha+raw_img*(1.0-raw_alpha)
    composed=composed.astype(np.uint8)
    return composed

def erode(np_mask):
    kernel = cv2.getStructuringElement(cv2.MORPH_RECT, (3, 3))
    # closed = cv2.morphologyEx(np_mask, cv2.MORPH_CLOSE, kernel, iterations=3)
    eroded = cv2.erode(np_mask, kernel)
    return eroded
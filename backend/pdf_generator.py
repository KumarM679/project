"""
PDF Generator for JalDrishti Urban Flood Nowcasting System.
Generates compliant PDF 1.4 reports for location hydro-informatics,
risk analysis, drainage telemetry, and emergency response trends.
No external dependencies required (pure Python).
"""

import os
import re
from datetime import datetime

class MinimalPDF:
    def __init__(self, page_width=595.28, page_height=841.89):
        self.width = page_width
        self.height = page_height
        self.pages = []
        self.current_stream = []

    def start_page(self):
        if self.current_stream:
            self.pages.append("".join(self.current_stream))
            self.current_stream = []

    def _rgb(self, r, g, b):
        return f"{r/255.0:.3f} {g/255.0:.3f} {b/255.0:.3f}"

    def rect(self, x, y, w, h, fill_color=None, stroke_color=None, line_width=1):
        cmds = []
        cmds.append(f"{line_width:.2f} w")
        if fill_color:
            cmds.append(f"{self._rgb(*fill_color)} rg")
        if stroke_color:
            cmds.append(f"{self._rgb(*stroke_color)} RG")
        cmds.append(f"{x:.2f} {y:.2f} {w:.2f} {h:.2f} re")
        if fill_color and stroke_color:
            cmds.append("B")
        elif fill_color:
            cmds.append("f")
        elif stroke_color:
            cmds.append("S")
        self.current_stream.append(" ".join(cmds) + "\n")

    def line(self, x1, y1, x2, y2, color=(200, 200, 200), line_width=1):
        cmds = [
            f"{line_width:.2f} w",
            f"{self._rgb(*color)} RG",
            f"{x1:.2f} {y1:.2f} m",
            f"{x2:.2f} {y2:.2f} l",
            "S"
        ]
        self.current_stream.append(" ".join(cmds) + "\n")

    def _escape(self, s):
        if s is None:
            return ""
        s = str(s)
        # Escape parenthesis and backslashes for PDF string literal
        s = s.replace('\\', '\\\\').replace('(', '\\(').replace(')', '\\)')
        # Replace non-ascii chars with clean ascii equivalents
        return "".join(c if ord(c) < 128 else ' ' for c in s)

    def text(self, x, y, s, font="F1", size=10, color=(0, 0, 0)):
        escaped = self._escape(s)
        cmds = [
            "BT",
            f"/{font} {size:.1f} Tf",
            f"{self._rgb(*color)} rg",
            f"{x:.2f} {y:.2f} Td",
            f"({escaped}) Tj",
            "ET"
        ]
        self.current_stream.append(" ".join(cmds) + "\n")

    def text_right(self, right_x, y, s, font="F1", size=10, color=(0, 0, 0), avg_char_width=0.55):
        escaped = self._escape(s)
        approx_width = len(s) * size * avg_char_width
        x = max(20, right_x - approx_width)
        self.text(x, y, s, font=font, size=size, color=color)

    def build_pdf(self):
        if self.current_stream:
            self.pages.append("".join(self.current_stream))
            self.current_stream = []

        objects = []
        
        # 1: Catalog
        # 2: Pages
        # 3..: Page objects, Contents, Fonts
        # Let's organize standard structure:
        # Font F1: Helvetica
        # Font F2: Helvetica-Bold
        # Font F3: Helvetica-Oblique
        
        num_pages = len(self.pages)
        page_obj_ids = []
        content_obj_ids = []
        
        # Object allocation:
        # 1: Catalog
        # 2: Pages
        # 3: Font F1
        # 4: Font F2
        # 5: Font F3
        # For each page i (0-based):
        #   page_obj: 6 + 2*i
        #   content_obj: 6 + 2*i + 1
        
        font_f1_id = 3
        font_f2_id = 4
        font_f3_id = 5
        
        current_id = 6
        for _ in range(num_pages):
            page_obj_ids.append(current_id)
            content_obj_ids.append(current_id + 1)
            current_id += 2
            
        # Build object strings
        # Obj 1: Catalog
        obj_catalog = f"<< /Type /Catalog /Pages 2 0 R >>"
        
        # Obj 2: Pages
        kids_str = " ".join([f"{pid} 0 R" for pid in page_obj_ids])
        obj_pages = f"<< /Type /Pages /Kids [{kids_str}] /Count {num_pages} >>"
        
        # Obj 3, 4, 5: Fonts
        obj_f1 = "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>"
        obj_f2 = "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold /Encoding /WinAnsiEncoding >>"
        obj_f3 = "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Oblique /Encoding /WinAnsiEncoding >>"
        
        all_objs = {
            1: obj_catalog,
            2: obj_pages,
            3: obj_f1,
            4: obj_f2,
            5: obj_f3
        }
        
        for idx in range(num_pages):
            p_id = page_obj_ids[idx]
            c_id = content_obj_ids[idx]
            stream_content = self.pages[idx]
            stream_bytes = stream_content.encode('latin1')
            
            p_obj = (
                f"<< /Type /Page /Parent 2 0 R /MediaBox [0 0 {self.width:.2f} {self.height:.2f}] "
                f"/Contents {c_id} 0 R "
                f"/Resources << /Font << /F1 {font_f1_id} 0 R /F2 {font_f2_id} 0 R /F3 {font_f3_id} 0 R >> >> >>"
            )
            all_objs[p_id] = p_obj
            
            c_obj = f"<< /Length {len(stream_bytes)} >>\nstream\n{stream_content}endstream"
            all_objs[c_id] = c_obj
            
        # Assemble PDF with cross-reference table
        output = [b"%PDF-1.4\n"]
        offsets = {0: 0}
        
        max_id = max(all_objs.keys())
        for obj_num in range(1, max_id + 1):
            offsets[obj_num] = sum(len(chunk) for chunk in output)
            content = all_objs[obj_num]
            if isinstance(content, str):
                content_bytes = content.encode('latin1')
            else:
                content_bytes = content
            output.append(f"{obj_num} 0 obj\n".encode('latin1'))
            output.append(content_bytes)
            output.append(b"\nendobj\n")
            
        xref_offset = sum(len(chunk) for chunk in output)
        output.append(f"xref\n0 {max_id + 1}\n".encode('latin1'))
        output.append(b"0000000000 65535 f \n")
        for obj_num in range(1, max_id + 1):
            output.append(f"{offsets[obj_num]:010d} 00000 n \n".encode('latin1'))
            
        output.append(f"trailer\n<< /Size {max_id + 1} /Root 1 0 R >>\n".encode('latin1'))
        output.append(f"startxref\n{xref_offset}\n%%EOF".encode('latin1'))
        
        return b"".join(output)


def generate_location_analytics_pdf(location_data):
    """
    Renders an executive A4 PDF Hydro-Informatics & Flood Risk Report
    for a specific street/location corridor.
    """
    pdf = MinimalPDF(page_width=595.28, page_height=841.89)
    
    st = location_data.get('street', {})
    dr = location_data.get('drainage', {})
    rf = location_data.get('rainfall', {})
    risk = location_data.get('risk', {})
    incidents = location_data.get('incidents', [])
    hotspot_info = location_data.get('hotspot_info', {})
    
    street_name = st.get('name', 'Urban Corridor')
    city = st.get('city', 'Metropolitan Area')
    ward_name = st.get('ward_name', 'Central Ward')
    ward_no = st.get('ward_no', 'N/A')
    
    # Page 1: Executive Dossier
    # Header Banner (Deep Navy #0f172a)
    pdf.rect(0, 755, 595.28, 86.89, fill_color=(15, 23, 42))
    
    # Top accent line (Teal #0d9488)
    pdf.rect(0, 836.89, 595.28, 5, fill_color=(13, 148, 136))
    
    pdf.text(36, 810, "JALDRISHTI : URBAN FLOOD NOWCASTING & HYDROLOGIC ANALYTICS", font="F2", size=13, color=(255, 255, 255))
    pdf.text(36, 792, "MUNICIPAL EMERGENCY OPERATIONS CENTER (EOC) • OFFICIAL LOCATION DOSSIER", font="F1", size=8.5, color=(148, 163, 184))
    
    report_id = f"DOS-{city[:3].upper()}-{st.get('id', 1):03d}-{datetime.now().strftime('%Y%m%d%H%M')}"
    pdf.text_right(559, 810, report_id, font="F2", size=9, color=(45, 212, 191))
    gen_time_str = datetime.now().strftime('%d %b %Y, %H:%M IST')
    pdf.text_right(559, 792, f"Generated: {gen_time_str}", font="F1", size=8, color=(203, 213, 225))
    
    # Location Headline Box
    pdf.rect(36, 680, 523.28, 62, fill_color=(248, 250, 252), stroke_color=(226, 232, 240), line_width=1)
    # Severity badge color
    score = float(risk.get('risk_score', 65.0))
    if score >= 80:
        badge_bg = (244, 63, 94) # Rose
        badge_txt = "CRITICAL FLOOD RISK"
    elif score >= 55:
        badge_bg = (249, 115, 22) # Orange
        badge_txt = "HIGH RISK WARNING"
    elif score >= 30:
        badge_bg = (234, 179, 8) # Amber
        badge_txt = "MODERATE WATCH"
    else:
        badge_bg = (16, 185, 129) # Emerald
        badge_txt = "NORMAL STATUS"
        
    pdf.text(48, 722, f"Corridor: {street_name}", font="F2", size=14, color=(15, 23, 42))
    pdf.text(48, 702, f"Administrative Ward: {ward_name} (Ward #{ward_no})  |  City: {city}  |  Type: {st.get('road_type', 'Arterial Road')}", font="F1", size=9, color=(71, 85, 105))
    
    # Draw badge
    pdf.rect(420, 712, 125, 20, fill_color=badge_bg)
    pdf.text(430, 717, badge_txt, font="F2", size=8.5, color=(255, 255, 255))
    pdf.text(435, 695, f"Risk Score: {score:.1f}/100", font="F2", size=9, color=(15, 23, 42))
    
    # Section 1: Geographical & Catchment Topography
    pdf.text(36, 658, "1. GEOGRAPHICAL TOPOGRAPHY & CATCHMENT PARAMETERS", font="F2", size=10, color=(15, 23, 42))
    pdf.line(36, 652, 559.28, 652, color=(203, 213, 225), line_width=1)
    
    # 4-col KPI cards for Geography
    kpis_geo = [
        ("Elevation", f"{st.get('elevation_meters', 910):.1f} m MSL", "Above mean sea level"),
        ("Slope Gradient", f"{st.get('slope_gradient', 1.2):.2f}%", "Terrain drainage grade"),
        ("Catchment Area", f"{st.get('catchment_area_sqm', 45000):,.0f} m²", "Storm catchment footprint"),
        ("Imperviousness", f"{int(st.get('surface_imperviousness', 0.85)*100)}%", "Asphalt/concrete runoff ratio")
    ]
    card_w = (523.28 - 24) / 4
    for i, (k_title, k_val, k_sub) in enumerate(kpis_geo):
        cx = 36 + i * (card_w + 8)
        pdf.rect(cx, 595, card_w, 50, fill_color=(255, 255, 255), stroke_color=(226, 232, 240), line_width=1)
        pdf.text(cx + 8, 630, k_title, font="F1", size=8, color=(100, 116, 139))
        pdf.text(cx + 8, 614, k_val, font="F2", size=11, color=(15, 23, 42))
        pdf.text(cx + 8, 602, k_sub, font="F1", size=6.5, color=(148, 163, 184))

    # Section 2: Real-Time Rainfall Telemetry & Hydro-Load
    pdf.text(36, 574, "2. REAL-TIME RAINFALL TELEMETRY & RUNOFF NOWCAST", font="F2", size=10, color=(15, 23, 42))
    pdf.line(36, 568, 559.28, 568, color=(203, 213, 225), line_width=1)
    
    intensity = float(rf.get('current_intensity_mm_hr', 42.0))
    acc_1h = float(rf.get('accumulation_1h', 35.0))
    acc_24h = float(rf.get('accumulation_24h', 85.0))
    forecast_2h = float(rf.get('forecast_next_2h_mm_hr', 48.0))
    station_source = rf.get('station_name', 'Automated Weather Station (IMD/Municipal Telemetry)')
    
    kpis_rain = [
        ("Current Intensity", f"{intensity:.1f} mm/h", "Telemetry sensor feed"),
        ("1-Hour Accumulation", f"{acc_1h:.1f} mm", "Past 60 mins rainfall"),
        ("24-Hour Cumulative", f"{acc_24h:.1f} mm", "Soil saturation precursor"),
        ("Next 2-Hour Nowcast", f"{forecast_2h:.1f} mm/h", "Radar-derived forecast")
    ]
    for i, (k_title, k_val, k_sub) in enumerate(kpis_rain):
        cx = 36 + i * (card_w + 8)
        pdf.rect(cx, 510, card_w, 50, fill_color=(240, 249, 255), stroke_color=(186, 230, 253), line_width=1)
        pdf.text(cx + 8, 545, k_title, font="F1", size=8, color=(3, 105, 161))
        pdf.text(cx + 8, 529, k_val, font="F2", size=11, color=(12, 74, 96))
        pdf.text(cx + 8, 517, k_sub, font="F1", size=6.5, color=(56, 189, 248))
        
    pdf.text(36, 496, f"Data Origin: {station_source}  |  Sensor Health: Operational", font="F3", size=7.5, color=(100, 116, 139))

    # Section 3: Subsurface Drainage Network & Outfall Bottleneck
    pdf.text(36, 474, "3. SUBSURFACE DRAINAGE INFRASTRUCTURE & DISCHARGE OUTFALL", font="F2", size=10, color=(15, 23, 42))
    pdf.line(36, 468, 559.28, 468, color=(203, 213, 225), line_width=1)
    
    dr_code = dr.get('drain_code', 'DRN-LOC-001')
    dr_type = dr.get('drain_type', 'RCC Covered Box Drain')
    nom_cap = float(dr.get('nominal_capacity_mm_hr', 45.0))
    blockage = float(dr.get('current_blockage_pct', 35.0))
    eff_cap = nom_cap * (1.0 - (blockage / 100.0))
    silt_depth = float(dr.get('silt_depth_cm', 18.0))
    outfall = dr.get('discharge_outfall', 'Stormwater Canal Outfall')
    
    # Table layout for Drainage
    drain_box_y = 380
    pdf.rect(36, drain_box_y, 523.28, 80, fill_color=(255, 255, 255), stroke_color=(226, 232, 240), line_width=1)
    
    # Row 1
    pdf.text(48, 442, "Drain Asset Identifier:", font="F2", size=8.5, color=(71, 85, 105))
    pdf.text(175, 442, f"{dr_code} ({dr_type})", font="F2", size=8.5, color=(15, 23, 42))
    
    pdf.text(330, 442, "Structural Integrity:", font="F2", size=8.5, color=(71, 85, 105))
    pdf.text(435, 442, dr.get('structural_status', 'Good'), font="F2", size=8.5, color=(15, 23, 42))
    
    # Row 2
    pdf.text(48, 422, "Nominal Drain Capacity:", font="F1", size=8.5, color=(71, 85, 105))
    pdf.text(175, 422, f"{nom_cap:.1f} mm/hr discharge", font="F1", size=8.5, color=(15, 23, 42))
    
    pdf.text(330, 422, "Effective Cleared Capacity:", font="F2", size=8.5, color=(71, 85, 105))
    pdf.text(435, 422, f"{eff_cap:.1f} mm/hr ({blockage:.0f}% blocked)", font="F2", size=8.5, color=(225, 29, 72) if blockage > 40 else (15, 23, 42))
    
    # Row 3
    pdf.text(48, 402, "Silt Accumulation Depth:", font="F1", size=8.5, color=(71, 85, 105))
    pdf.text(175, 402, f"{silt_depth:.1f} cm silt bed", font="F1", size=8.5, color=(15, 23, 42))
    
    pdf.text(330, 402, "Discharge Outfall Channel:", font="F1", size=8.5, color=(71, 85, 105))
    pdf.text(435, 402, outfall[:30], font="F1", size=8.5, color=(15, 23, 42))
    
    # Blockage visual bar inside the box
    pdf.text(48, 388, "Silt Blockage Meter:", font="F1", size=7.5, color=(100, 116, 139))
    pdf.rect(175, 386, 200, 7, fill_color=(226, 232, 240))
    bar_w = max(2, min(200, 200 * (blockage / 100.0)))
    bar_color = (239, 68, 68) if blockage > 50 else (245, 158, 11) if blockage > 25 else (16, 185, 129)
    pdf.rect(175, 386, bar_w, 7, fill_color=bar_color)
    pdf.text(382, 388, f"{blockage:.1f}% choke ratio", font="F2", size=7.5, color=bar_color)

    # Section 4: Quantitative Hydro-Risk & Inundation Simulation
    pdf.text(36, 360, "4. QUANTITATIVE FLOOD RISK & HYDRAULIC BALANCE", font="F2", size=10, color=(15, 23, 42))
    pdf.line(36, 354, 559.28, 354, color=(203, 213, 225), line_width=1)
    
    eff_runoff = float(risk.get('effective_rainfall_mm_hr', intensity * 0.85))
    eff_drain = float(risk.get('effective_drainage_capacity_mm_hr', eff_cap))
    net_surplus = max(0.0, eff_runoff - eff_drain)
    
    balance_box_y = 286
    pdf.rect(36, balance_box_y, 523.28, 60, fill_color=(254, 242, 242) if net_surplus > 10 else (248, 250, 252),
             stroke_color=(254, 205, 205) if net_surplus > 10 else (226, 232, 240), line_width=1)
    
    pdf.text(48, 330, "Precipitation Runoff Inflow:", font="F1", size=8.5, color=(71, 85, 105))
    pdf.text(180, 330, f"{eff_runoff:.1f} mm/hr", font="F2", size=9, color=(15, 23, 42))
    
    pdf.text(310, 330, "Drain Evacuation Rate:", font="F1", size=8.5, color=(71, 85, 105))
    pdf.text(435, 330, f"{eff_drain:.1f} mm/hr", font="F2", size=9, color=(15, 23, 42))
    
    pdf.text(48, 310, "Hydraulic Ponding Deficit:", font="F2", size=8.5, color=(159, 18, 57) if net_surplus > 0 else (5, 150, 105))
    surplus_desc = f"+{net_surplus:.1f} mm/hr (Active Inundation Buildup)" if net_surplus > 0 else "0.0 mm/hr (Safe Infiltration Capacity)"
    pdf.text(180, 310, surplus_desc, font="F2", size=9, color=(159, 18, 57) if net_surplus > 0 else (5, 150, 105))
    
    rec_text = risk.get('action_summary', 'Deploy emergency diesel suction pumps and divert light vehicular traffic.')
    pdf.text(48, 294, f"Prescribed Action: {rec_text[:75]}", font="F3", size=8, color=(71, 85, 105))

    # Section 5: Historical Recurrence & Municipal Emergency Response History
    pdf.text(36, 266, "5. HISTORICAL FLOOD RECURRENCE & MUNICIPAL EMERGENCY DEPLOYMENT", font="F2", size=10, color=(15, 23, 42))
    pdf.line(36, 260, 559.28, 260, color=(203, 213, 225), line_width=1)
    
    hist_events = hotspot_info.get('historical_events_year', 12)
    vuln_idx = hotspot_info.get('vulnerability_index', int(score))
    root_cause = hotspot_info.get('primary_cause', 'Low-elevation valley depression with undersized storm culvert.')
    
    hist_box_y = 175
    pdf.rect(36, hist_box_y, 523.28, 77, fill_color=(255, 255, 255), stroke_color=(226, 232, 240), line_width=1)
    
    pdf.text(48, 236, "Annual Incident Frequency:", font="F1", size=8.5, color=(71, 85, 105))
    pdf.text(180, 236, f"{hist_events} flood episodes / year", font="F2", size=8.5, color=(15, 23, 42))
    
    pdf.text(320, 236, "Vulnerability Index:", font="F1", size=8.5, color=(71, 85, 105))
    pdf.text(435, 236, f"{vuln_idx} / 100", font="F2", size=8.5, color=(225, 29, 72))
    
    pdf.text(48, 218, "Topographic Root Cause:", font="F1", size=8.5, color=(71, 85, 105))
    pdf.text(180, 218, root_cause[:65], font="F1", size=8, color=(51, 65, 85))
    
    # Incident deployment summary for this location
    pumps_for_loc = sum([i.get('dewatering_pumps_deployed', 0) for i in incidents])
    suction_for_loc = sum([i.get('suction_vehicles_count', 0) for i in incidents])
    active_incidents = len([i for i in incidents if i.get('status') != 'Completed'])
    
    pdf.text(48, 198, "Assigned Emergency Assets:", font="F2", size=8.5, color=(71, 85, 105))
    pdf.text(180, 198, f"{pumps_for_loc} Heavy Diesel Pumps  |  {suction_for_loc} Suction Tankers  |  {active_incidents} Active Triage Cases",
             font="F2", size=8.5, color=(13, 148, 136))
             
    pdf.text(48, 183, "Response SLA Benchmark:", font="F1", size=8, color=(100, 116, 139))
    pdf.text(180, 183, "42 Minutes Mean Time to Dewater Arterial Carriageway (Standard Protocol)", font="F3", size=8, color=(71, 85, 105))

    # Official EOC Endorsement Stamp & Legal Notice (Bottom Footer)
    pdf.rect(36, 52, 523.28, 105, fill_color=(248, 250, 252), stroke_color=(203, 213, 225), line_width=1)
    
    pdf.text(48, 140, "EXECUTIVE ENDORSEMENT & QUALITY ASSURANCE", font="F2", size=8.5, color=(15, 23, 42))
    pdf.line(48, 134, 545, 134, color=(226, 232, 240), line_width=0.75)
    
    pdf.text(48, 120, "Certified by: Chief Hydrologist, EOC Disaster Command Center", font="F1", size=8, color=(51, 65, 85))
    pdf.text(48, 105, "Calibrated Engine: JalDrishti Physical Rational Method + Machine Learning Spatial Nowcast", font="F1", size=7.5, color=(71, 85, 105))
    pdf.text(48, 92, "Legal Notice: This document is an operational flood risk evaluation generated for municipal engineers,", font="F3", size=7, color=(100, 116, 139))
    pdf.text(48, 81, "traffic emergency controllers, and civil defense coordinators. All runoff calculations reflect simulated telemetry.", font="F3", size=7, color=(100, 116, 139))
    
    # Official Seal / Signature block
    pdf.rect(400, 62, 145, 65, fill_color=(255, 255, 255), stroke_color=(13, 148, 136), line_width=1.2)
    pdf.text(410, 112, "EOC DISASTER MGMT", font="F2", size=7.5, color=(13, 148, 136))
    pdf.text(410, 99, "VERIFIED OFFICIAL", font="F2", size=9, color=(15, 23, 42))
    pdf.text(410, 86, f"REF: {report_id[-12:]}", font="F1", size=7, color=(100, 116, 139))
    pdf.text(410, 72, f"STAMP: {datetime.now().strftime('%Y-%m-%d')}", font="F2", size=7, color=(13, 148, 136))
    
    # Page Footer
    pdf.text(36, 36, "JalDrishti Hydro-Informatics Platform • Confidential Municipal Operations", font="F1", size=7.5, color=(148, 163, 184))
    pdf.text_right(559, 36, "Page 1 of 1", font="F2", size=7.5, color=(100, 116, 139))
    
    return pdf.build_pdf()

import os
import streamlit as st
import pandas as pd
import plotly.express as px
from datetime import datetime

# ==========================================
# PAGE CONFIGURATION & THEMING
# ==========================================
st.set_page_config(
    page_title="MarginMind - Financial Intelligence",
    page_icon="📊",
    layout="wide",
    initial_sidebar_state="expanded"
)

# Custom CSS for UI/UX Polish
st.markdown("""
    <style>
    .main-header {
        font-size: 2.2rem;
        font-weight: 700;
        color: #1E88E5;
        margin-bottom: 0px;
    }
    .sub-header {
        font-size: 1.1rem;
        color: #B0BEC5;
        margin-bottom: 20px;
    }
    </style>
""", unsafe_allow_html=True)

# ==========================================
# SIDEBAR & BRANDING
# ==========================================
logo_path = "logo.png"
if os.path.exists(logo_path):
    st.sidebar.image(logo_path, use_column_width=True)
else:
    st.sidebar.title("📊 MarginMind")

st.sidebar.markdown("---")
st.sidebar.header("Company Settings")
company_name = st.sidebar.text_input("Company Name", "Demo Company")
reported_profit = st.sidebar.number_input("Reported Profit (₹)", value=2600000.0, step=100000.0)

st.sidebar.markdown("---")
st.sidebar.caption("MarginMind v1.0 • Hackathon Edition")

# ==========================================
# MAIN DASHBOARD HEADER
# ==========================================
st.markdown(f"<div class='main-header'>MarginMind — {company_name}</div>", unsafe_allow_html=True)
st.markdown("<div class='sub-header'>Financial Integrity & Recon Analysis Platform</div>", unsafe_allow_html=True)

st.info("💡 **Notice**: A financial discrepancy is a signal for investigation, not proof of fraud.")

# ==========================================
# FILE UPLOAD & RECONCILIATION ENGINE
# ==========================================
uploaded_file = st.file_uploader("Upload Financial Transaction Ledger (CSV)", type=["csv"])

if uploaded_file is not None:
    try:
        df = pd.read_csv(uploaded_file)
        
        required_cols = ["reference_id", "type", "amount"]
        if not all(col in df.columns for col in required_cols):
            st.error(f"Invalid CSV structure. Missing required columns: `{required_cols}`")
        else:
            # Data Processing
            df["amount"] = pd.to_numeric(df["amount"], errors="coerce").fillna(0)
            df["type"] = df["type"].astype(str).str.lower().str.strip()
            
            # Key Calculations
            total_revenue = df[df["type"] == "revenue"]["amount"].sum()
            total_expenses = df[df["type"] == "expense"]["amount"].sum()
            reconstructed_profit = total_revenue - total_expenses
            discrepancy = reported_profit - reconstructed_profit
            
            st.markdown("### 📈 Executive Summary")
            
            # Metric Display Cards
            m1, m2, m3, m4 = st.columns(4)
            m1.metric("Total Revenue", f"₹{total_revenue:,.0f}")
            m2.metric("Total Expenses", f"₹{total_expenses:,.0f}")
            m3.metric("Reconstructed Profit", f"₹{reconstructed_profit:,.0f}")
            m4.metric(
                "Discrepancy", 
                f"₹{abs(discrepancy):,.0f}", 
                delta=f"₹{-discrepancy:,.0f}", 
                delta_inverse=True
            )
            
            st.markdown("---")
            
            # Status Alerts
            if discrepancy == 0:
                st.success("✅ **Reconciliation Match**: Reported profit matches calculated profit exactly.")
            else:
                st.warning(f"⚠️ **Unexplained Discrepancy**: Reported profit differs from calculated profit by **₹{abs(discrepancy):,.0f}**.")

            # Dashboard Tabs for UI Organization
            tab1, tab2, tab3, tab4 = st.tabs(["📊 Financial Visuals", "📋 Transaction Ledger", "🔍 Anomaly Detection", "📥 Download Report"])
            
            with tab1:
                chart_df = pd.DataFrame({
                    "Category": ["Total Revenue", "Total Expenses", "Reconstructed Profit", "Reported Profit"],
                    "Amount (₹)": [total_revenue, total_expenses, reconstructed_profit, reported_profit]
                })
                fig = px.bar(
                    chart_df, 
                    x="Category", 
                    y="Amount (₹)", 
                    color="Category", 
                    text_auto=".2s",
                    title="Financial Overview & Profit Reconciliation"
                )
                fig.update_layout(showlegend=False)
                st.plotly_chart(fig, use_container_width=True)
                
            with tab2:
                st.subheader("Raw Ledger Entries")
                st.dataframe(df, use_container_width=True)
                
            with tab3:
                st.subheader("Automated Anomaly Audit")
                
                # Check 1: Duplicate Transaction IDs
                duplicates = df[df.duplicated(subset=["reference_id"], keep=False)]
                if not duplicates.empty:
                    st.error(f"🚨 **Duplicate Reference IDs Detected**: Found {len(duplicates)} records.")
                    st.dataframe(duplicates)
                else:
                    st.success("✅ No duplicate reference IDs detected.")
                    
                # Check 2: High Value Transactions (> 25% of Revenue)
                high_val = df[df["amount"] > (total_revenue * 0.25)]
                if not high_val.empty:
                    st.info("ℹ️ **High-Value Items**: Transactions exceeding 25% of total revenue:")
                    st.dataframe(high_val)

            with tab4:
                st.subheader("Export Investigation Report")
                st.write("Generate and download a structured summary report for auditors or investors.")
                
                # Create summary report dataframe
                report_data = pd.DataFrame({
                    "Metric": ["Company Name", "Analysis Timestamp", "Reported Profit (₹)", "Total Revenue (₹)", "Total Expenses (₹)", "Reconstructed Profit (₹)", "Absolute Discrepancy (₹)"],
                    "Value": [company_name, datetime.now().strftime("%Y-%m-%d %H:%M:%S"), reported_profit, total_revenue, total_expenses, reconstructed_profit, abs(discrepancy)]
                })
                
                csv_report = report_data.to_csv(index=False).encode('utf-8')
                
                st.download_button(
                    label="📥 Download Audit Summary (CSV)",
                    data=csv_report,
                    file_name=f"{company_name}_MarginMind_Report.csv",
                    mime="text/csv",
                )

    except Exception as e:
        st.error(f"Error reading file: {e}")
else:
    st.info("👆 Upload `sample_transactions.csv` above to run the analysis.")